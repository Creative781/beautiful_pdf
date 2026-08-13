import { App, Component, MarkdownRenderer, TFile, requestUrl } from "obsidian";
import { profileToCss } from "./css";
import {
	applyNoteTableLayouts,
	type NoteTableLayouts,
} from "./table-layout";
import type { Profile } from "./types";
import { applyPageBreakMarkers } from "./util";

export interface RenderedNote {
	htmlDocument: string;
	title: string;
	/** Body inner HTML only (self-contained; images inlined as data URLs). */
	bodyHtml: string;
	css: string;
}

export interface RenderOptions {
	/** Saved or freshly edited table column/row layouts for this note. */
	tableLayouts?: NoteTableLayouts | null;
}

/** Render a note to a self-contained HTML document using the active profile CSS. */
export async function renderNoteHtml(
	app: App,
	file: TFile,
	profile: Profile,
	options: RenderOptions = {},
): Promise<RenderedNote> {
	const raw = await app.vault.cachedRead(file);
	const markdown = applyPageBreakMarkers(raw);
	const title = profile.page.useFilenameAsTitle
		? file.basename
		: (app.metadataCache.getFileCache(file)?.frontmatter?.title as string) ||
			file.basename;

	const comp = new Component();
	comp.load();

	const host = document.body.createDiv({
		cls: "beautiful-pdf-render-host",
		attr: {
			style: `position:fixed;left:-10000px;top:0;width:${contentWidthPx(profile)}px;visibility:hidden;`,
		},
	});
	const viewEl = host.createDiv({
		cls: "markdown-preview-view markdown-rendered",
	});

	if (profile.page.useFilenameAsTitle) {
		viewEl.createEl("h1", { text: title, cls: "__title__" });
	}

	try {
		await MarkdownRenderer.render(app, markdown, viewEl, file.path, comp);
		await waitForEmbeds(viewEl);
		convertCanvases(viewEl);
		await rewriteInternalImages(app, file, viewEl);
		cleanupImageEmbeds(viewEl);
		stripUiChrome(viewEl);
		applyNoteTableLayouts(viewEl, options.tableLayouts);

		const css = profileToCss(profile);
		const bodyHtml = viewEl.innerHTML;
		const htmlDocument = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeAttr(title)}</title>
<style>${css}</style>
</head>
<body>
<div class="markdown-preview-view markdown-rendered">
${bodyHtml}
</div>
</body>
</html>`;

		return { htmlDocument, title, bodyHtml, css };
	} finally {
		comp.unload();
		host.remove();
	}
}

async function waitForEmbeds(el: HTMLElement, ms = 800): Promise<void> {
	const hasHeavy =
		el.querySelector("img, .internal-embed, .markdown-embed, canvas") != null;
	if (!hasHeavy) return;
	await sleep(ms);
}

function sleep(ms: number): Promise<void> {
	return new Promise((r) => window.setTimeout(r, ms));
}

function convertCanvases(el: HTMLElement): void {
	el.querySelectorAll("canvas").forEach((canvas) => {
		try {
			const img = createEl("img");
			img.src = canvas.toDataURL();
			img.alt = "canvas";
			canvas.replaceWith(img);
		} catch {
			/* ignore tainted canvas */
		}
	});
}

/** Resolve vault images and embed them as data URLs for a blank print webview. */
async function rewriteInternalImages(
	app: App,
	file: TFile,
	el: HTMLElement,
): Promise<void> {
	const imgs = Array.from(el.querySelectorAll("img"));
	await Promise.all(
		imgs.map(async (img) => {
			const src = img.getAttribute("src");
			if (!src || src.startsWith("data:")) return;

			let dest: TFile | null = null;
			try {
				dest = app.metadataCache.getFirstLinkpathDest(
					decodeURIComponent(src.split("?")[0]),
					file.path,
				);
			} catch {
				dest = null;
			}
			if (!dest) dest = resolveImageFile(app, file, src);

			if (dest) {
				try {
					const data = await app.vault.readBinary(dest);
					img.setAttribute(
						"src",
						`data:${mimeFromExtension(dest.extension)};base64,${arrayBufferToBase64(data)}`,
					);
					return;
				} catch {
					/* try resource path / fetch below */
				}
				try {
					const resPath = app.vault.adapter.getResourcePath(dest.path);
					img.setAttribute("src", resPath);
				} catch {
					/* keep original */
				}
			}

			const current = img.getAttribute("src");
			if (!current || current.startsWith("data:")) return;
			try {
				const res = await requestUrl({ url: current });
				if (res.status >= 400) return;
				const data = res.arrayBuffer;
				const contentType = res.headers["content-type"] ?? res.headers["Content-Type"];
				const mime =
					contentType?.split(";")[0] ||
					mimeFromExtension(current.split(".").pop() || "");
				img.setAttribute(
					"src",
					`data:${mime};base64,${arrayBufferToBase64(data)}`,
				);
			} catch {
				/* keep original src */
			}
		}),
	);
}

/**
 * Wiki image embeds (`![[file]]`) leave chrome / leftover `[` text nodes.
 * Unwrap to a plain <img> for clean PDF output.
 */
function cleanupImageEmbeds(el: HTMLElement): void {
	const embeds = el.querySelectorAll(
		".internal-embed.media-embed, .internal-embed.image-embed, span.image-embed, span.media-embed",
	);
	embeds.forEach((span) => {
		const img = span.querySelector("img");
		if (!img) {
			// Failed embed — drop leftover wiki syntax text like "[" / "![[...]]"
			span.remove();
			return;
		}
		// Remove any leftover text nodes (e.g. stray "[")
		Array.from(span.childNodes).forEach((node) => {
			if (node.nodeType === Node.TEXT_NODE) node.remove();
			else if (node !== img && (node as HTMLElement).tagName !== "IMG") {
				const nestedImg = (node as HTMLElement).querySelector?.("img");
				if (!nestedImg) node.remove();
			}
		});
		const alt = img.getAttribute("alt") || "";
		if (alt.startsWith("[") || alt.includes("![[")) {
			img.setAttribute("alt", alt.replace(/^\[+|!?\[\[|\]\]$/g, "").trim());
		}
		span.replaceWith(img);
	});

	// Orphan text nodes that are only brackets next to images
	el.querySelectorAll("p, div, span").forEach((block) => {
		Array.from(block.childNodes).forEach((node) => {
			if (node.nodeType !== Node.TEXT_NODE) return;
			const t = (node.textContent || "").trim();
			if (t === "[" || t === "]" || t === "![" || t === "[[") {
				node.remove();
			}
		});
	});
}

/** Remove editor-only chrome that should not appear in PDF. */
function stripUiChrome(el: HTMLElement): void {
	el.querySelectorAll(
		".copy-code-button, .code-block-buttons, .edit-block-button, button.copy-code-button",
	).forEach((node) => node.remove());
}

/**
 * Embed vault images as data URLs so print webview can use about:blank
 * (no Obsidian help.html origin, no help branding race).
 */
function resolveImageFile(app: App, fromFile: TFile, src: string): TFile | null {
	const raw = decodeURIComponent(src.split("?")[0] || "");
	const candidates = [raw];
	const slash = raw.lastIndexOf("/");
	if (slash >= 0) candidates.push(raw.slice(slash + 1));
	// app://local/.../vaultRelative/path.png → try vault-relative tail
	const localIdx = raw.indexOf("/Mobile Documents/");
	if (localIdx >= 0) {
		const after = raw.slice(localIdx);
		const vaultMarker = "/Documents/";
		const vi = after.lastIndexOf(vaultMarker);
		if (vi >= 0) candidates.push(after.slice(vi + vaultMarker.length));
	}
	for (const c of candidates) {
		const dest = app.metadataCache.getFirstLinkpathDest(c, fromFile.path);
		if (dest instanceof TFile) return dest;
		const byPath = app.vault.getAbstractFileByPath(c);
		if (byPath instanceof TFile) return byPath;
	}
	return null;
}

function mimeFromExtension(ext: string): string {
	const e = ext.replace(/^\./, "").toLowerCase();
	const map: Record<string, string> = {
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		webp: "image/webp",
		svg: "image/svg+xml",
		bmp: "image/bmp",
		avif: "image/avif",
	};
	return map[e] || "application/octet-stream";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
	const bytes = new Uint8Array(buffer);
	let binary = "";
	const chunk = 0x8000;
	for (let i = 0; i < bytes.length; i += chunk) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
	}
	return btoa(binary);
}

function contentWidthPx(profile: Profile): number {
	const page = profile.page;
	const widthMm =
		page.pageSize === "Custom"
			? page.pageWidthMm
			: page.pageSize === "Letter" || page.pageSize === "Legal"
				? 215.9
				: 210;
	const contentMm = Math.max(
		40,
		widthMm - page.marginLeftMm - page.marginRightMm,
	);
	// CSS reference pixel ≈ 96dpi
	return Math.round((contentMm / 25.4) * 96);
}

function escapeAttr(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
