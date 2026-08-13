import { Notice, type App, type TFile } from "obsidian";
import { headerFooterTemplates } from "./css";
import { renderNoteHtml } from "./render";
import type { NoteTableLayouts } from "./table-layout";
import type { Profile } from "./types";

/** Minimal typing for Electron <webview> used by Obsidian desktop. */
interface PrintWebview extends HTMLElement {
	src: string;
	printToPDF: (options: Record<string, unknown>) => Promise<Uint8Array>;
	executeJavaScript: (code: string) => Promise<unknown>;
}

type ElectronRemote = {
	dialog: {
		showSaveDialog: (opts: unknown) => Promise<{ canceled: boolean; filePath?: string }>;
	};
	shell: { openPath: (path: string) => Promise<string> };
};

type ElectronModule = {
	remote?: ElectronRemote;
};

type FsModule = {
	promises: { writeFile: (path: string, data: Uint8Array) => Promise<void> };
};

type UnknownRequire = (id: string) => unknown;

function getNodeRequire(): UnknownRequire {
	const win = window as Window & { require?: UnknownRequire };
	if (typeof win.require !== "function") {
		throw new Error(
			"Electron remote API is unavailable. Beautiful PDF works on Obsidian desktop only.",
		);
	}
	return win.require;
}

function getElectron(): {
	remote: ElectronRemote;
	fs: FsModule;
} {
	const req = getNodeRequire();
	const electron = req("electron") as ElectronModule;
	const fs = req("fs") as FsModule;
	let remote: ElectronRemote | undefined = electron.remote;
	if (!remote) {
		try {
			remote = req("@electron/remote") as ElectronRemote;
		} catch {
			/* fall through — try electron.remote only */
		}
	}
	if (!remote?.dialog) {
		throw new Error(
			"Electron remote API is unavailable. Beautiful PDF works on Obsidian desktop only.",
		);
	}
	return { remote, fs };
}

export interface PdfResult {
	data: Uint8Array;
	title: string;
}

export interface GeneratePdfOptions {
	tableLayouts?: NoteTableLayouts | null;
}

/** Render note and produce PDF bytes (same path for preview + export). */
export async function generatePdf(
	app: App,
	file: TFile,
	profile: Profile,
	options: GeneratePdfOptions = {},
): Promise<PdfResult> {
	const rendered = await renderNoteHtml(app, file, profile, {
		tableLayouts: options.tableLayouts,
	});
	const data = await printHtmlToPdf(rendered, profile);
	return { data, title: rendered.title };
}

export async function exportPdfToFile(
	app: App,
	file: TFile,
	profile: Profile,
	openAfter = true,
	options: GeneratePdfOptions = {},
): Promise<string | null> {
	const notice = new Notice("Beautiful PDF: generating…", 0);
	try {
		const { data, title } = await generatePdf(app, file, profile, options);
		const { remote, fs } = getElectron();
		const result = await remote.dialog.showSaveDialog({
			title: "Export Beautiful PDF",
			defaultPath: `${title}.pdf`,
			filters: [{ name: "PDF", extensions: ["pdf"] }],
			properties: ["showOverwriteConfirmation", "createDirectory"],
		});
		if (result.canceled || !result.filePath) {
			notice.hide();
			return null;
		}
		await fs.promises.writeFile(result.filePath, data);
		notice.hide();
		new Notice("Beautiful PDF: saved");
		if (openAfter) {
			await remote.shell.openPath(result.filePath);
		}
		return result.filePath;
	} catch (err) {
		notice.hide();
		console.error(err);
		new Notice(`Beautiful PDF error: ${String(err)}`);
		return null;
	}
}

/**
 * Print via a blank webview + document.write of our HTML.
 * Never navigate to Obsidian help.html — its logo/branding can race into printToPDF.
 */
async function printHtmlToPdf(
	rendered: { htmlDocument: string; bodyHtml: string; css: string; title: string },
	profile: Profile,
): Promise<Uint8Array> {
	const webview = createHiddenWebview();
	const ready = waitForDomReady(webview);
	document.body.appendChild(webview);
	webview.src = "about:blank";

	try {
		await ready;

		// Replace the blank document entirely (no help.html leftovers possible).
		await webview.executeJavaScript(`
			(() => {
				document.open();
				document.write(${JSON.stringify(rendered.htmlDocument)});
				document.close();
			})();
		`);

		await webview.executeJavaScript(`
			(() => new Promise((resolve) => {
				const waitImages = () => Promise.all(
					Array.from(document.images).map((img) => {
						if (img.complete) return Promise.resolve();
						return new Promise((r) => {
							img.onload = img.onerror = () => r();
							setTimeout(r, 3000);
						});
					}),
				);
				const finish = () => waitImages().then(() => resolve(true));
				if (document.readyState === "complete") finish();
				else window.addEventListener("load", finish, { once: true });
			}))();
		`);
		await sleep(100);

		const hf = headerFooterTemplates(profile);
		const page = profile.page;
		let pageSize: string | { width: number; height: number } = page.pageSize;
		if (page.pageSize === "Custom") {
			pageSize = {
				width: page.pageWidthMm / 25.4,
				height: page.pageHeightMm / 25.4,
			};
		}

		const printOptions = {
			landscape: false,
			printBackground: page.printBackground,
			pageSize,
			scale: 1,
			margins: {
				marginType: "custom" as const,
				top: page.marginTopMm / 25.4,
				bottom: page.marginBottomMm / 25.4,
				left: page.marginLeftMm / 25.4,
				right: page.marginRightMm / 25.4,
			},
			displayHeaderFooter: hf.displayHeaderFooter,
			headerTemplate: hf.headerTemplate,
			footerTemplate: hf.footerTemplate,
		};

		const data = await webview.printToPDF(printOptions);
		return data;
	} finally {
		webview.remove();
	}
}

function createHiddenWebview(): PrintWebview {
	return createEl("webview" as keyof HTMLElementTagNameMap, {
		cls: "beautiful-pdf-print-webview",
		attr: {
			webpreferences: "nodeIntegration=yes",
		},
	}) as unknown as PrintWebview;
}

function waitForDomReady(webview: PrintWebview): Promise<void> {
	return new Promise((resolve, reject) => {
		const t = window.setTimeout(() => reject(new Error("webview timeout")), 15000);
		webview.addEventListener(
			"dom-ready",
			() => {
				window.clearTimeout(t);
				resolve();
			},
			{ once: true },
		);
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => window.setTimeout(r, ms));
}
