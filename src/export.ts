import { Notice, type App, type TFile } from "obsidian";
import { headerFooterTemplates } from "./css";
import { renderNoteHtml } from "./render";
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

function getElectron(): {
	remote: ElectronRemote;
	fs: { promises: { writeFile: (path: string, data: Uint8Array) => Promise<void> } };
} {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const req = (window as any).require as NodeRequire;
	const electron = req("electron");
	const fs = req("fs");
	let remote: ElectronRemote | undefined = electron.remote;
	if (!remote) {
		try {
			remote = req("@electron/remote");
		} catch {
			/* fall through */
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

/** Render note and produce PDF bytes (same path for preview + export). */
export async function generatePdf(
	app: App,
	file: TFile,
	profile: Profile,
): Promise<PdfResult> {
	const rendered = await renderNoteHtml(app, file, profile);
	const data = await printHtmlToPdf(rendered, profile);
	return { data, title: rendered.title };
}

export async function exportPdfToFile(
	app: App,
	file: TFile,
	profile: Profile,
	openAfter = true,
): Promise<string | null> {
	const notice = new Notice("Beautiful PDF: generating…", 0);
	try {
		const { data, title } = await generatePdf(app, file, profile);
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

async function printHtmlToPdf(
	rendered: { htmlDocument: string; bodyHtml: string; css: string; title: string },
	profile: Profile,
): Promise<Uint8Array> {
	const webview = createHiddenWebview();
	document.body.appendChild(webview);

	try {
		await waitForDomReady(webview);

		// Replace help.html contents entirely so Obsidian help branding cannot leak
		await webview.executeJavaScript(`
			(() => {
				document.head.innerHTML = "";
				document.body.innerHTML = "";
				document.querySelectorAll("img, svg, picture, video").forEach((n) => n.remove());
				const meta = document.createElement("meta");
				meta.setAttribute("charset", "utf-8");
				document.head.appendChild(meta);
				const title = document.createElement("title");
				title.textContent = ${JSON.stringify(rendered.title)};
				document.head.appendChild(title);
				const style = document.createElement("style");
				style.textContent = ${JSON.stringify(rendered.css)};
				document.head.appendChild(style);
				document.body.innerHTML = ${JSON.stringify(
					`<div class="markdown-preview-view markdown-rendered">${rendered.bodyHtml}</div>`,
				)};
				document.documentElement.style.background = "#fff";
				document.body.style.background = "#fff";
				document.body.style.margin = "0";
			})();
		`);

		// Wait for vault images (app://) to settle
		await webview.executeJavaScript(`
			Promise.all(
				Array.from(document.images).map((img) => {
					if (img.complete) return Promise.resolve();
					return new Promise((resolve) => {
						img.onload = img.onerror = () => resolve();
						setTimeout(resolve, 3000);
					});
				}),
			);
		`);
		await sleep(250);

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
	const webview = document.createElement("webview") as unknown as PrintWebview;
	webview.setAttribute(
		"style",
		"position:fixed;left:-2000px;top:0;width:794px;height:1123px;opacity:0;pointer-events:none;",
	);
	webview.setAttribute("webpreferences", "nodeIntegration=yes");
	// Same origin as Obsidian so vault app:// image paths resolve
	webview.src = "app://obsidian.md/help.html";
	return webview;
}

function waitForDomReady(webview: PrintWebview): Promise<void> {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error("webview timeout")), 15000);
		webview.addEventListener(
			"dom-ready",
			() => {
				clearTimeout(t);
				resolve();
			},
			{ once: true },
		);
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}
