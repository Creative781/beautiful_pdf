/** Normalize legacy ratio (1.7) or percent (170) to percent. */
export function toLineHeightPercent(value: number | undefined, fallback = 170): number {
	if (value == null || Number.isNaN(value)) return fallback;
	if (value > 0 && value <= 10) return Math.round(value * 100);
	return value;
}

/** CSS line-height value from stored percent. */
export function lineHeightCss(value: number | undefined, fallback = 170): string {
	return `${toLineHeightPercent(value, fallback)}%`;
}

/**
 * Replace page-break markers in markdown before rendering.
 * Supported:
 * - %%pdf-pagebreak%%  (Obsidian comment; invisible while writing)
 * - <!-- pdf-pagebreak -->
 * - \pagebreak
 */
export function applyPageBreakMarkers(markdown: string): string {
	return markdown
		.replace(/%%\s*pdf-pagebreak\s*%%/gi, PAGE_BREAK_HTML)
		.replace(/<!--\s*pdf-pagebreak\s*-->/gi, PAGE_BREAK_HTML)
		.replace(/\\pagebreak\b/gi, PAGE_BREAK_HTML);
}

export const PAGE_BREAK_HTML =
	'\n\n<div class="pdf-pagebreak" data-pdf-pagebreak="true"></div>\n\n';

export const PAGE_BREAK_SNIPPET = "%%pdf-pagebreak%%\n";
