import { App, FuzzySuggestModal, Notice, type FuzzyMatch } from "obsidian";

interface LocalFontData {
	family: string;
	fullName: string;
	postscriptName: string;
	style: string;
}

type QueryLocalFonts = () => Promise<LocalFontData[]>;

type NodeRequireFn = (id: string) => unknown;

type ExecFileFn = (
	file: string,
	args: string[],
	opts: Record<string, unknown>,
	cb: (err: unknown, stdout: string, stderr: string) => void,
) => void;

/** Sensible fallbacks when enumeration APIs fail. */
const FALLBACK_FONTS = [
	"Arial",
	"Calibri",
	"Cambria",
	"Comic Sans MS",
	"Consolas",
	"Courier New",
	"Georgia",
	"KoPubWorld Batang",
	"KoPubWorld Dotum",
	"Malgun Gothic",
	"Noto Sans KR",
	"Noto Serif KR",
	"Pretendard",
	"Segoe UI",
	"Tahoma",
	"Times New Roman",
	"Verdana",
	"ui-monospace",
	"ui-sans-serif",
	"ui-serif",
];

let cachedFamilies: string[] | null = null;
let loading: Promise<string[]> | null = null;

function getNodeRequire(): NodeRequireFn | null {
	const win = window as Window & { require?: NodeRequireFn };
	return typeof win.require === "function" ? win.require : null;
}

function getQueryLocalFonts(): QueryLocalFonts | null {
	const fn: QueryLocalFonts | undefined = (
		window as Window & { queryLocalFonts?: QueryLocalFonts }
	).queryLocalFonts;
	return typeof fn === "function" ? fn : null;
}

function getPlatform(): string | null {
	try {
		const req = getNodeRequire();
		if (!req) return null;
		const proc = req("process");
		if (!proc || typeof proc !== "object") return null;
		const platform = (proc as { platform?: unknown }).platform;
		return typeof platform === "string" ? platform : null;
	} catch {
		return null;
	}
}

function getExecFile(): ExecFileFn | null {
	const req = getNodeRequire();
	if (!req) return null;
	const child = req("child_process");
	if (!child || typeof child !== "object") return null;
	const execFile = (child as { execFile?: unknown }).execFile;
	return typeof execFile === "function" ? (execFile as ExecFileFn) : null;
}

function execFileUtf8(
	execFile: ExecFileFn,
	file: string,
	args: string[],
	opts: Record<string, unknown>,
): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(file, args, opts, (err, stdout) => {
			if (err) {
				reject(err instanceof Error ? err : new Error("execFile failed"));
			} else {
				resolve(typeof stdout === "string" ? stdout : "");
			}
		});
	});
}

function uniqSorted(names: Iterable<string>): string[] {
	const set = new Set<string>();
	for (const n of names) {
		const t = n.trim();
		if (t) set.add(t);
	}
	return Array.from(set).sort((a, b) =>
		a.localeCompare(b, undefined, { sensitivity: "base" }),
	);
}

async function listFromQueryLocalFonts(): Promise<string[]> {
	const query = getQueryLocalFonts();
	if (!query) return [];
	try {
		const fonts = await query();
		return fonts.map((f) => (f.family || "").trim()).filter(Boolean);
	} catch (err) {
		console.warn("Beautiful PDF: queryLocalFonts failed", err);
		return [];
	}
}

/**
 * Windows: System.Drawing InstalledFontCollection via PowerShell.
 * Chromium queryLocalFonts often omits user-installed / some CJK families.
 */
async function listFromWindows(): Promise<string[]> {
	const execFile = getExecFile();
	if (!execFile) return [];
	try {
		const ps = [
			"$ErrorActionPreference = 'SilentlyContinue'",
			"Add-Type -AssemblyName System.Drawing",
			"$names = New-Object 'System.Collections.Generic.HashSet[string]'",
			"$coll = New-Object System.Drawing.Text.InstalledFontCollection",
			"foreach ($f in $coll.Families) { [void]$names.Add($f.Name) }",
			"# Also read font registry display names (file → family label)",
			"$keys = @(",
			"  'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts',",
			"  'HKCU:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'",
			")",
			"foreach ($k in $keys) {",
			"  if (-not (Test-Path $k)) { continue }",
			"  $props = Get-ItemProperty -Path $k",
			"  foreach ($p in $props.PSObject.Properties) {",
			"    if ($p.Name -match '^(PSPath|PSParentPath|PSChildName|PSDrive|PSProvider)$') { continue }",
			"    $label = ($p.Name -replace '\\s*\\(TrueType\\)\\s*$','' -replace '\\s*\\(OpenType\\)\\s*$','').Trim()",
			"    if ($label) { [void]$names.Add($label) }",
			"  }",
			"}",
			"$names | Sort-Object",
		].join("; ");

		const stdout = await execFileUtf8(
			execFile,
			"powershell.exe",
			["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
			{
				encoding: "utf8",
				windowsHide: true,
				timeout: 20000,
				maxBuffer: 16 * 1024 * 1024,
			},
		);

		return stdout
			.split(/\r?\n/)
			.map((s) => s.trim())
			.filter(Boolean);
	} catch (err) {
		console.warn("Beautiful PDF: Windows font enumeration failed", err);
		return [];
	}
}

/** macOS: system_profiler font database (supplements queryLocalFonts). */
async function listFromMac(): Promise<string[]> {
	const execFile = getExecFile();
	if (!execFile) return [];
	try {
		const stdout = await execFileUtf8(
			execFile,
			"/usr/sbin/system_profiler",
			["SPFontsDataType", "-json"],
			{
				encoding: "utf8",
				timeout: 30000,
				maxBuffer: 32 * 1024 * 1024,
			},
		);
		const data = JSON.parse(stdout) as {
			SPFontsDataType?: Array<{ type?: string; _name?: string }>;
		};
		const names: string[] = [];
		for (const item of data.SPFontsDataType ?? []) {
			// Prefer full typeface family label when present
			const type = (item.type || item._name || "").trim();
			if (type) names.push(type);
		}
		return names;
	} catch (err) {
		console.warn("Beautiful PDF: macOS font enumeration failed", err);
		return [];
	}
}

/** Linux: fontconfig family list. */
async function listFromLinux(): Promise<string[]> {
	const execFile = getExecFile();
	if (!execFile) return [];
	try {
		const stdout = await execFileUtf8(
			execFile,
			"fc-list",
			[":", "family"],
			{ encoding: "utf8", timeout: 15000, maxBuffer: 16 * 1024 * 1024 },
		);
		const names: string[] = [];
		for (const line of stdout.split(/\r?\n/)) {
			for (const part of line.split(",")) {
				const t = part.trim();
				if (t) names.push(t);
			}
		}
		return names;
	} catch (err) {
		console.warn("Beautiful PDF: Linux font enumeration failed", err);
		return [];
	}
}

async function listFromPlatform(): Promise<string[]> {
	const platform = getPlatform();
	if (platform === "win32") return listFromWindows();
	if (platform === "darwin") return listFromMac();
	if (platform === "linux") return listFromLinux();
	return [];
}

/** Unique installed font family names (Chromium API + OS enumeration). */
export async function listSystemFontFamilies(): Promise<string[]> {
	if (cachedFamilies) return cachedFamilies;
	if (loading !== null) return loading;

	const promise: Promise<string[]> = (async () => {
		const [fromApi, fromOs] = await Promise.all([
			listFromQueryLocalFonts(),
			listFromPlatform(),
		]);
		const merged = uniqSorted([...fromApi, ...fromOs, ...FALLBACK_FONTS]);
		cachedFamilies = merged.length > 0 ? merged : FALLBACK_FONTS.slice().sort();
		return cachedFamilies;
	})();

	loading = promise;
	void promise.finally(() => {
		loading = null;
	});

	return promise;
}

/** Force a fresh scan (e.g. after installing fonts). */
export function clearFontCache(): void {
	cachedFamilies = null;
	loading = null;
}

/** Searchable picker; each row previews in its own typeface. */
export class FontSuggestModal extends FuzzySuggestModal<string> {
	private fonts: string[];
	private onPick: (font: string) => void;

	constructor(app: App, fonts: string[], onPick: (font: string) => void) {
		super(app);
		this.fonts = fonts;
		this.onPick = onPick;
		// SuggestModal defaults to ~100 rows; systems often have far more families.
		this.limit = Math.max(fonts.length, 1000);
		this.setPlaceholder("Search installed fonts…");
		this.setInstructions([
			{ command: "↑↓", purpose: "navigate" },
			{ command: "↵", purpose: "choose" },
			{ command: "esc", purpose: "close" },
		]);
	}

	getItems(): string[] {
		return this.fonts;
	}

	getItemText(item: string): string {
		return item;
	}

	renderSuggestion(value: FuzzyMatch<string>, el: HTMLElement): void {
		super.renderSuggestion(value, el);
		const safe = value.item.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
		el.setCssStyles({ fontFamily: `"${safe}", sans-serif` });
	}

	onChooseItem(item: string): void {
		this.onPick(item);
	}
}

export async function openFontPicker(
	app: App,
	onPick: (font: string) => void,
): Promise<void> {
	// Always rescan so newly installed Windows fonts appear.
	clearFontCache();
	const fonts = await listSystemFontFamilies();
	if (fonts.length === 0) {
		new Notice("Beautiful PDF: no fonts found on this system.");
		return;
	}
	new FontSuggestModal(app, fonts, onPick).open();
}
