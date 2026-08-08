import { App, Component, MarkdownRenderer, TFile } from "obsidian";
import { profileToCss } from "./css";
import type { Profile } from "./types";
import { applyPageBreakMarkers } from "./util";

export interface RenderedNote {
	htmlDocument: string;
	title: string;
	/** Body inner HTML only (for webview injection without help.html leftovers). */
	bodyHtml: string;
	css: string;
}

/** Render a note to a self-contained HTML document using the active profile CSS. */
export async function renderNoteHtml(
	app: App,
	file: TFile,
	profile: Profile,
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
		attr: { style: "position:fixed;left:-10000px;top:0;width:800px;visibility:hidden;" },
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
		rewriteInternalImages(app, file, viewEl);
		cleanupImageEmbeds(viewEl);
		stripUiChrome(viewEl);

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

/** Resolve vault image src to app:// or data URLs where possible. */
function rewriteInternalImages(app: App, file: TFile, el: HTMLElement): void {
	el.querySelectorAll("img").forEach((img) => {
		const src = img.getAttribute("src");
		if (!src || src.startsWith("data:") || src.startsWith("http")) return;
		try {
			const dest = app.metadataCache.getFirstLinkpathDest(
				decodeURIComponent(src.split("?")[0]),
				file.path,
			);
			if (dest) {
				const resPath = app.vault.adapter.getResourcePath(dest.path);
				img.setAttribute("src", resPath);
			}
		} catch {
			/* keep original */
		}
	});
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

function escapeAttr(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
