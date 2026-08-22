import { Notice, type App, type TFile } from "obsidian";
import {
	headerFooterContext,
	headerFooterTemplates,
	type HeaderFooterContext,
} from "./placeholders";
import { renderNoteHtml } from "./render";
import type { NoteImageLayouts } from "./image-layout";
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
	imageLayouts?: NoteImageLayouts | null;
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
		imageLayouts: options.imageLayouts,
	});
	const hfCtx = headerFooterContext(app, file, rendered.title);
	const data = await printHtmlToPdf(
		rendered,
		profile,
		options.tableLayouts,
		hfCtx,
	);
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
	tableLayouts: NoteTableLayouts | null | undefined,
	hfCtx: HeaderFooterContext,
): Promise<Uint8Array> {
	const pageW = contentWidthPx(profile);
	const webview = createHiddenWebview(pageW);
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

		// Re-apply with absolute px against the page content width (not webview guesswork).
		if (tableLayouts?.tables?.length) {
			const result = await webview.executeJavaScript(
				buildApplyTableLayoutsScript(tableLayouts, pageW),
			);
			console.debug("[Beautiful PDF] table layout apply", result);
		}

		await sleep(200);

		const hf = headerFooterTemplates(profile, hfCtx);
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

/**
 * Script run inside the print webview to force column/table geometry with
 * pixel widths (resolved against the PDF content column) right before printToPDF.
 */
function buildApplyTableLayoutsScript(
	layouts: NoteTableLayouts,
	contentWidthPx: number,
): string {
	return `(() => {
		const layouts = ${JSON.stringify(layouts)};
		const parentW = ${Math.max(40, Math.round(contentWidthPx))};
		const root = document.querySelector(".markdown-preview-view") || document.body;
		document.documentElement.style.setProperty("width", parentW + "px", "important");
		document.documentElement.style.setProperty("max-width", parentW + "px", "important");
		document.body.style.setProperty("width", parentW + "px", "important");
		document.body.style.setProperty("max-width", parentW + "px", "important");
		document.body.style.setProperty("margin", "0", "important");
		document.body.style.setProperty("padding", "0", "important");
		if (root && root.style) {
			root.style.setProperty("width", parentW + "px", "important");
			root.style.setProperty("max-width", parentW + "px", "important");
			root.style.setProperty("box-sizing", "border-box", "important");
		}
		const tables = Array.from(document.querySelectorAll("table"));
		let applied = 0;
		for (const layout of layouts.tables || []) {
			const table = tables[layout.index];
			if (!table) continue;
			table.style.setProperty("table-layout", "fixed", "important");
			table.style.setProperty("box-sizing", "border-box", "important");

			let tablePx = parentW;
			if (layout.widthPct != null && layout.widthPct > 0) {
				tablePx = Math.max(40, (Number(layout.widthPct) / 100) * parentW);
			} else {
				tablePx = table.getBoundingClientRect().width || parentW;
			}
			tablePx = Math.round(tablePx);
			table.style.setProperty("width", tablePx + "px", "important");
			table.style.setProperty("min-width", tablePx + "px", "important");
			table.style.setProperty("max-width", tablePx + "px", "important");

			const align = layout.align === "center" || layout.align === "right" ? layout.align : "left";
			if (align === "center") {
				table.style.setProperty("margin-left", "auto", "important");
				table.style.setProperty("margin-right", "auto", "important");
			} else if (align === "right") {
				table.style.setProperty("margin-left", "auto", "important");
				table.style.setProperty("margin-right", "0", "important");
			} else if (layout.align === "left") {
				table.style.setProperty("margin-left", "0", "important");
				table.style.setProperty("margin-right", "auto", "important");
			}
			const colsPct = layout.colWidthsPct || [];
			const n = colsPct.length;
			if (n > 0) {
				let group = table.querySelector("colgroup");
				if (!group) {
					group = document.createElement("colgroup");
					table.insertBefore(group, table.firstChild);
				}
				while (group.children.length > n) group.lastElementChild.remove();
				while (group.children.length < n) {
					group.appendChild(document.createElement("col"));
				}
				const sum = colsPct.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
				const colPx = [];
				for (let i = 0; i < n; i++) {
					const pct = ((Number(colsPct[i]) || 0) / sum) * 100;
					colPx.push(Math.max(8, Math.round((pct / 100) * tablePx)));
				}
				for (let i = 0; i < n; i++) {
					const col = group.children[i];
					const w = colPx[i] + "px";
					col.style.setProperty("width", w, "important");
					col.style.setProperty("min-width", w, "important");
					col.style.setProperty("max-width", w, "important");
					col.setAttribute("width", String(colPx[i]));
				}
				for (const row of Array.from(table.rows)) {
					let colAt = 0;
					for (const cell of Array.from(row.cells)) {
						const span = cell.colSpan || 1;
						let spanPx = 0;
						for (let k = 0; k < span && colAt + k < n; k++) spanPx += colPx[colAt + k];
						if (spanPx > 0) {
							const w = spanPx + "px";
							cell.style.setProperty("width", w, "important");
							cell.style.setProperty("min-width", w, "important");
							cell.style.setProperty("max-width", w, "important");
							cell.style.setProperty("box-sizing", "border-box", "important");
							cell.setAttribute("width", String(spanPx));
						}
						colAt += span;
					}
				}
			}

			if (layout.rowHeightsPx && layout.rowHeightsPx.length) {
				for (let i = 0; i < layout.rowHeightsPx.length; i++) {
					const h = Number(layout.rowHeightsPx[i]);
					if (!(h > 0) || !table.rows[i]) continue;
					table.rows[i].style.setProperty("height", Math.round(h) + "px", "important");
				}
			}
			if (layout.heightPx != null && Number(layout.heightPx) > 0) {
				table.style.setProperty(
					"height",
					Math.round(Number(layout.heightPx)) + "px",
					"important",
				);
			}
			applied++;
		}
		return { tables: tables.length, applied: applied, parentW: parentW };
	})()`;
}

function contentWidthPx(profile: Profile): number {
	const page = profile.page;
	const widthMm =
		page.pageSize === "Custom"
			? page.pageWidthMm
			: page.pageSize === "Letter" || page.pageSize === "Legal"
				? 215.9
				: 210;
	const contentMm = Math.max(40, widthMm - page.marginLeftMm - page.marginRightMm);
	return Math.round((contentMm / 25.4) * 96);
}

function createHiddenWebview(contentWidthPx: number): PrintWebview {
	const w = Math.max(400, Math.round(contentWidthPx));
	const el = createEl("webview" as keyof HTMLElementTagNameMap, {
		cls: "beautiful-pdf-print-webview",
		attr: {
			webpreferences: "nodeIntegration=yes",
			style: `width:${w}px;height:1123px;`,
		},
	}) as unknown as PrintWebview;
	return el;
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
