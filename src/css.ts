import type { ElementStyle, Profile } from "./types";
import { frameStyleExtras } from "./frame";
import { lineHeightCss } from "./util";

function rule(selector: string, style: ElementStyle, extra: string[] = []): string {
	const decls = [
		`font-family: ${style.fontFamily}`,
		`font-size: ${style.fontSize}pt`,
		`font-weight: ${style.fontWeight}`,
		`text-align: ${style.align}`,
		`color: ${style.color}`,
		`margin-top: ${style.marginTop}pt`,
		`margin-bottom: ${style.marginBottom}pt`,
	];
	if (style.backgroundColor) {
		decls.push(`background: ${style.backgroundColor}`);
		decls.push(`background-color: ${style.backgroundColor}`);
	}
	if (style.lineHeight != null) {
		decls.push(`line-height: ${lineHeightCss(style.lineHeight)}`);
	}
	if (style.paddingLeft != null) {
		decls.push(`padding-left: ${style.paddingLeft}pt`);
	}
	decls.push(...extra);
	return `${selector} {\n  ${decls.join(";\n  ")};\n}`;
}

/** Build print CSS from a style profile. */
export function profileToCss(profile: Profile): string {
	const e = profile.elements;
	const p = profile.page;

	const parts: string[] = [];

	parts.push(`
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: ${e.body.color};
  font-family: ${e.body.fontFamily};
  font-size: ${e.body.fontSize}pt;
  line-height: ${lineHeightCss(p.lineHeight)};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.markdown-preview-view,
.markdown-rendered {
  padding: 0 !important;
  margin: 0 !important;
  background: transparent !important;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  max-width: none !important;
}
.markdown-preview-view .mod-header,
.markdown-preview-sizer { max-width: none !important; width: 100% !important; margin: 0 !important; }
p { ${inline(e.body)} }
`);

	parts.push(rule("h1, h1.__title__", e.h1));
	parts.push(rule("h2", e.h2));
	parts.push(rule("h3", e.h3));
	parts.push(rule("h4", e.h4));
	parts.push(rule("h5", e.h5));
	parts.push(rule("h6", e.h6));

	parts.push(rule("blockquote", e.blockquote, frameStyleExtras("blockquote", e.blockquote)));

	parts.push(rule("ul, ol", e.list, ["padding-left: 1.4em"]));
	parts.push(rule("li", e.list, [
		`margin-top: 0`,
		`margin-bottom: ${Math.max(2, e.list.marginBottom / 2)}pt`,
	]));

	parts.push(rule("ul.contains-task-list, .task-list-item", e.taskList, [
		"list-style: none",
		"padding-left: 0",
	]));
	parts.push(`
.task-list-item-checkbox,
input[type="checkbox"] {
  -webkit-appearance: none;
  appearance: none;
  width: 11pt;
  height: 11pt;
  margin: 0 0.45em 0 0;
  vertical-align: -1pt;
  border: 1px solid #555;
  border-radius: 2px;
  background: #fff !important;
  background-color: #fff !important;
  box-shadow: none !important;
  accent-color: #333;
}
.task-list-item-checkbox:checked,
input[type="checkbox"]:checked {
  background-color: #fff !important;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23333333' stroke-width='2' d='M3 8l3.5 3.5L13 4'/%3E%3C/svg%3E") !important;
  background-size: 90% 90% !important;
  background-position: center !important;
  background-repeat: no-repeat !important;
  border-color: #555;
}
`);

	parts.push(rule("code", e.codeInline, [
		`background: ${e.codeInline.backgroundColor ?? "rgba(0,0,0,0.06)"}`,
		"padding: 0.1em 0.35em",
		"border-radius: 3px",
		"margin: 0",
	]));
	parts.push(rule("pre, pre > code", e.codeBlock, [
		`background: ${e.codeBlock.backgroundColor ?? "#f4f4f4"}`,
		"padding: 10pt",
		"border-radius: 4px",
		"overflow-x: auto",
		"white-space: pre-wrap",
		"word-break: break-word",
		"display: block",
		"position: relative",
	]));
	parts.push(`pre code { background: transparent !important; padding: 0; }`);
	parts.push(`
.copy-code-button,
.code-block-buttons,
button.copy-code-button,
.markdown-rendered button.copy-code-button,
pre > button,
.edit-block-button {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  pointer-events: none !important;
}
`);

	parts.push(rule("hr", e.hr, [
		"border: none",
		`border-top: 1px solid ${e.hr.color}`,
		"height: 0",
	]));

	parts.push(`
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: ${e.table.marginTop}pt;
  margin-bottom: ${e.table.marginBottom}pt;
  font-family: ${e.table.fontFamily};
  font-size: ${e.table.fontSize}pt;
  color: ${e.table.color};
  line-height: ${lineHeightCss(e.table.lineHeight, 140)};
  break-inside: auto;
}
th, td {
  border: 1px solid #bbb;
  padding: 5pt 7pt;
  text-align: left;
  vertical-align: top;
}
th {
  font-family: ${e.tableHeader.fontFamily};
  font-size: ${e.tableHeader.fontSize}pt;
  font-weight: ${e.tableHeader.fontWeight};
  color: ${e.tableHeader.color};
  background: ${e.tableHeader.backgroundColor ?? "#f0f0f0"};
}
tr { break-inside: avoid; }
`);

	parts.push(rule(".callout", e.callout, frameStyleExtras("callout", e.callout)));
	parts.push(rule(".callout-title", e.calloutTitle));
	parts.push(`.callout-content { margin-top: 4pt; }`);

	parts.push(`
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin-top: ${e.image.marginTop}pt;
  margin-bottom: ${e.image.marginBottom}pt;
  margin-left: ${e.image.align === "center" ? "auto" : e.image.align === "right" ? "auto" : "0"};
  margin-right: ${e.image.align === "center" ? "auto" : "0"};
}
`);

	parts.push(rule("a", e.link, [
		"text-decoration: underline",
		"margin: 0",
	]));
	parts.push(`a.internal-link { color: ${e.link.color}; }`);

	parts.push(rule(".footnote-ref, sup", e.footnote, [
		"margin: 0",
		"font-size: 0.75em",
	]));
	parts.push(rule("section.footnotes, .footnotes", e.footnote, [
		"border-top: 1px solid #ccc",
		"padding-top: 8pt",
		"margin-top: 16pt",
	]));

	parts.push(
		rule(
			// Note embeds only — image/media embeds must not get quote-like chrome
			".internal-embed:not(.media-embed):not(.image-embed), .markdown-embed:not(.image-embed), .markdown-embed-content",
			e.embed,
			frameStyleExtras("embed", e.embed),
		),
	);
	parts.push(`
.internal-embed.media-embed,
.internal-embed.image-embed,
span.image-embed,
span.media-embed {
  background: transparent !important;
  border: none !important;
  border-left: none !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 0 !important;
  display: contents;
}
.internal-embed.media-embed img,
.internal-embed.image-embed img,
span.image-embed img {
  display: block;
}
`);

	parts.push(`
.frontmatter, .metadata-container, .mod-header .inline-title { display: none !important; }
.collapse-indicator, .clickable-icon { display: none !important; }
.copy-code-button, .code-block-buttons, .edit-block-button { display: none !important; }

.pdf-pagebreak {
  break-after: page;
  page-break-after: always;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  display: block;
}
`);

	return parts.join("\n");
}

function inline(style: ElementStyle): string {
	const decls = [
		`font-family: ${style.fontFamily}`,
		`font-size: ${style.fontSize}pt`,
		`font-weight: ${style.fontWeight}`,
		`text-align: ${style.align}`,
		`color: ${style.color}`,
		`margin-top: ${style.marginTop}pt`,
		`margin-bottom: ${style.marginBottom}pt`,
	];
	if (style.lineHeight != null) decls.push(`line-height: ${lineHeightCss(style.lineHeight)}`);
	return decls.join("; ") + ";";
}

export function headerFooterTemplates(profile: Profile): {
	displayHeaderFooter: boolean;
	headerTemplate: string;
	footerTemplate: string;
} {
	const p = profile.page;
	const showHeader = Boolean(p.headerText?.trim()) || p.pageNumber.startsWith("top");
	const showFooter =
		Boolean(p.footerText?.trim()) ||
		p.pageNumber.startsWith("bottom") ||
		p.pageNumber !== "none";

	const pageSpan = (format: string) => {
		// Chromium print templates use special classes for page numbers
		const html = format
			.replace(/\{page\}/g, `<span class="pageNumber"></span>`)
			.replace(/\{pages\}/g, `<span class="totalPages"></span>`);
		return html;
	};

	const baseStyle =
		"font-size: 9px; font-family: sans-serif; color: #666; width: 100%; padding: 0 8mm; box-sizing: border-box;";

	let headerTemplate = "<span></span>";
	let footerTemplate = "<span></span>";

	if (p.pageNumber === "top-center" || p.headerText) {
		const num =
			p.pageNumber === "top-center"
				? `<div style="text-align:center">${pageSpan(p.pageNumberFormat)}</div>`
				: "";
		const text = p.headerText
			? `<div style="text-align:${p.headerAlign ?? "left"}">${escapeHtml(p.headerText)}</div>`
			: "";
		headerTemplate = `<div style="${baseStyle}">${text}${num}</div>`;
	}

	if (p.pageNumber.startsWith("bottom") || p.footerText) {
		const numAlign =
			p.pageNumber === "bottom-right"
				? "right"
				: p.pageNumber === "bottom-center"
					? "center"
					: "left";
		const num =
			p.pageNumber !== "none" && p.pageNumber.startsWith("bottom")
				? `<div style="text-align:${numAlign}">${pageSpan(p.pageNumberFormat)}</div>`
				: "";
		const text = p.footerText
			? `<div style="text-align:${p.footerAlign ?? "center"}">${escapeHtml(p.footerText)}</div>`
			: "";
		footerTemplate = `<div style="${baseStyle}">${text}${num}</div>`;
	}

	if (p.pageNumber === "none" && !p.headerText && !p.footerText) {
		return {
			displayHeaderFooter: false,
			headerTemplate: " ",
			footerTemplate: " ",
		};
	}

	return {
		displayHeaderFooter: showHeader || showFooter,
		headerTemplate,
		footerTemplate,
	};
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
