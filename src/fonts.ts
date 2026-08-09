import { App, FuzzySuggestModal, Notice, type FuzzyMatch } from "obsidian";

interface LocalFontData {
	family: string;
	fullName: string;
	postscriptName: string;
	style: string;
}

type QueryLocalFonts = () => Promise<LocalFontData[]>;

/** Sensible fallbacks when Local Font Access API is unavailable. */
const FALLBACK_FONTS = [
	"Apple SD Gothic Neo",
	"AppleGothic",
	"Arial",
	"Courier New",
	"Georgia",
	"Helvetica Neue",
	"KoPubWorld Batang",
	"KoPubWorld Dotum",
	"Malgun Gothic",
	"Menlo",
	"Monaco",
	"Noto Sans KR",
	"Noto Serif KR",
	"Pretendard",
	"SF Mono",
	"SF Pro Text",
	"Songti SC",
	"Times New Roman",
	"ui-monospace",
	"ui-sans-serif",
	"ui-serif",
].sort((a, b) => a.localeCompare(b));

let cachedFamilies: string[] | null = null;
let loading: Promise<string[]> | null = null;

function getQueryLocalFonts(): QueryLocalFonts | null {
	const fn = (window as Window & { queryLocalFonts?: QueryLocalFonts }).queryLocalFonts;
	return typeof fn === "function" ? fn.bind(window) : null;
}

/** Unique installed font family names (desktop Chromium / Electron). */
export async function listSystemFontFamilies(): Promise<string[]> {
	if (cachedFamilies) return cachedFamilies;
	if (loading) return loading;

	loading = (async () => {
		const query = getQueryLocalFonts();
		if (!query) {
			cachedFamilies = FALLBACK_FONTS.slice();
			return cachedFamilies;
		}
		try {
			const fonts = await query();
			const set = new Set<string>();
			for (const f of fonts) {
				const family = (f.family || "").trim();
				if (family) set.add(family);
			}
			for (const f of FALLBACK_FONTS) set.add(f);
			cachedFamilies = Array.from(set).sort((a, b) =>
				a.localeCompare(b, undefined, { sensitivity: "base" }),
			);
			return cachedFamilies;
		} catch (err) {
			console.warn("Beautiful PDF: queryLocalFonts failed", err);
			cachedFamilies = FALLBACK_FONTS.slice();
			return cachedFamilies;
		} finally {
			loading = null;
		}
	})();

	return loading;
}

/** Searchable picker; each row previews in its own typeface. */
export class FontSuggestModal extends FuzzySuggestModal<string> {
	private fonts: string[];
	private onPick: (font: string) => void;

	constructor(app: App, fonts: string[], onPick: (font: string) => void) {
		super(app);
		this.fonts = fonts;
		this.onPick = onPick;
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
	const fonts = await listSystemFontFamilies();
	if (fonts.length === 0) {
		new Notice("Beautiful PDF: no fonts found on this system.");
		return;
	}
	new FontSuggestModal(app, fonts, onPick).open();
}
