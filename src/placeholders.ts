import type { App, TFile } from "obsidian";
import type { Profile } from "./types";

export interface HeaderFooterContext {
	title: string;
	filename: string;
	folder: string;
	vault: string;
	date: string;
	ctime: string;
	mtime: string;
	/** Note properties (YAML frontmatter), keyed as stored and lowercased. */
	properties: Record<string, string>;
}

export function headerFooterContext(
	app: App,
	file: TFile,
	title: string,
): HeaderFooterContext {
	const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
	return {
		title,
		filename: file.basename,
		folder: file.parent?.name ?? "",
		vault: app.vault.getName(),
		date: formatDay(new Date()),
		ctime: formatDay(new Date(file.stat.ctime)),
		mtime: formatDay(new Date(file.stat.mtime)),
		properties: frontmatterMap(fm),
	};
}

export function headerFooterTemplates(
	profile: Profile,
	ctx: HeaderFooterContext,
): {
	displayHeaderFooter: boolean;
	headerTemplate: string;
	footerTemplate: string;
} {
	const p = profile.page;
	const enable = profile.special.enablePlaceholders !== false;
	const headerSlots: HfSlot[] = [
		{ text: p.headerLeft, styleKey: p.headerLeftStyle },
		{ text: p.headerCenter, styleKey: p.headerCenterStyle },
		{ text: p.headerRight, styleKey: p.headerRightStyle },
	];
	const footerSlots: HfSlot[] = [
		{ text: p.footerLeft, styleKey: p.footerLeftStyle },
		{ text: p.footerCenter, styleKey: p.footerCenterStyle },
		{ text: p.footerRight, styleKey: p.footerRightStyle },
	];
	const showHeader = headerSlots.some((s) => s.text?.trim());
	const showFooter = footerSlots.some((s) => s.text?.trim());

	if (!showHeader && !showFooter) {
		return {
			displayHeaderFooter: false,
			headerTemplate: " ",
			footerTemplate: " ",
		};
	}

	return {
		displayHeaderFooter: true,
		headerTemplate: showHeader
			? threeColumnTemplate(headerSlots, profile, ctx, enable)
			: "<span></span>",
		footerTemplate: showFooter
			? threeColumnTemplate(footerSlots, profile, ctx, enable)
			: "<span></span>",
	};
}

type HfSlot = { text: string; styleKey: string };

function threeColumnTemplate(
	slots: HfSlot[],
	profile: Profile,
	ctx: HeaderFooterContext,
	enable: boolean,
): string {
	const aligns = ["left", "center", "right"] as const;
	const cells = slots.map((slot, i) => {
		const html = applyPlaceholders(slot.text ?? "", ctx, enable);
		const style = slotStyleCss(profile, slot.styleKey ?? "");
		const inner = style ? `<span style="${style}">${html}</span>` : html;
		return `<td style="width:33%;text-align:${aligns[i]};vertical-align:middle;padding:0 4px;">${inner}</td>`;
	});
	const base =
		"font-size:9px;font-family:sans-serif;color:#666;width:100%;padding:0 8mm;box-sizing:border-box;";
	return `<div style="${base}"><table style="width:100%;border-collapse:collapse;"><tr>${cells.join("")}</tr></table></div>`;
}

function slotStyleCss(profile: Profile, key: string): string {
	if (!key) return "";
	const style = profile.elements[key as keyof typeof profile.elements];
	if (!style) return "";
	// Chromium header/footer templates ignore many CSS units; px is reliable.
	const px = Math.max(7, Math.round((style.fontSize * 96) / 72));
	return [
		`font-family:${cssAttr(style.fontFamily)}`,
		`font-size:${px}px`,
		`font-weight:${cssAttr(String(style.fontWeight))}`,
		`color:${cssAttr(style.color)}`,
	].join(";");
}

/** Quotes in font stacks (e.g. "KoPubWorldDotum") must not break the style="..." attribute. */
function cssAttr(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/** Expand {{placeholders}} (and legacy {page}/{pages}) into print HTML. */
export function applyPlaceholders(
	raw: string,
	ctx: HeaderFooterContext,
	enable: boolean,
): string {
	if (!raw) return "";
	if (!enable) return escapeHtml(raw);
	const normalized = raw
		.replace(/\{*\{\{\s*page\s*\}\}\}*/g, "{{page}}")
		.replace(/\{*\{\{\s*pages\s*\}\}\}*/g, "{{pages}}")
		.replace(/(?<!\{)\{page\}(?!\})/g, "{{page}}")
		.replace(/(?<!\{)\{pages\}(?!\})/g, "{{pages}}");
	let out = "";
	let last = 0;
	const re = /\{\{\s*([^}]+?)\s*\}\}/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(normalized))) {
		out += escapeHtml(normalized.slice(last, match.index));
		out += placeholderToHtml(match[1], ctx);
		last = match.index + match[0].length;
	}
	out += escapeHtml(normalized.slice(last));
	return out;
}

function placeholderToHtml(name: string, ctx: HeaderFooterContext): string {
	const key = name.trim();
	const lower = key.toLowerCase();
	switch (lower) {
		case "page":
			return `<span class="pageNumber"></span>`;
		case "pages":
			return `<span class="totalPages"></span>`;
		case "date":
			return escapeHtml(ctx.date);
		case "title":
			return escapeHtml(ctx.title);
		case "filename":
			return escapeHtml(ctx.filename);
		case "folder":
			return escapeHtml(ctx.folder);
		case "vault":
			return escapeHtml(ctx.vault);
		case "ctime":
			return escapeHtml(ctx.ctime);
		case "mtime":
			return escapeHtml(ctx.mtime);
		default:
			return escapeHtml(ctx.properties[key] ?? ctx.properties[lower] ?? "");
	}
}

function frontmatterMap(fm: Record<string, unknown>): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(fm)) {
		if (k === "position") continue;
		if (v && typeof v === "object" && !Array.isArray(v)) continue;
		const s = fmString(v);
		if (!s) continue;
		out[k] = s;
		out[k.toLowerCase()] = s;
	}
	return out;
}

function fmString(value: unknown): string {
	if (value == null) return "";
	if (typeof value === "string") return value.trim();
	if (Array.isArray(value)) {
		return value
			.map((v) => String(v).trim())
			.filter(Boolean)
			.join(", ");
	}
	return String(value).trim();
}

function formatDay(d: Date): string {
	if (Number.isNaN(d.getTime())) return "";
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
