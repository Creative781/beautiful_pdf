import type { ElementStyle, FramePreset } from "./types";

type FrameKind = "blockquote" | "callout" | "embed";

const DEFAULT_BG: Record<FrameKind, string> = {
	blockquote: "rgba(0,0,0,0.03)",
	callout: "#f5f8fb",
	embed: "#fafafa",
};

/** Left-bar / outline accent when not driven by text color. */
const DEFAULT_ACCENT: Record<FrameKind, string> = {
	blockquote: "#6b7280",
	callout: "#6b8cae",
	embed: "#bbbbbb",
};

function accentFor(kind: FrameKind, style: ElementStyle): string {
	// Quote bar follows text color (existing behavior). Callout/embed keep a chrome accent.
	if (kind === "blockquote") return style.color || DEFAULT_ACCENT.blockquote;
	return DEFAULT_ACCENT[kind];
}

/** CSS extras for quote / callout / embed frame presets. */
export function frameStyleExtras(
	kind: FrameKind,
	style: ElementStyle,
): string[] {
	const preset: FramePreset = style.framePreset ?? "accent-bar";
	const bg = style.backgroundColor ?? DEFAULT_BG[kind];
	const accent = accentFor(kind, style);

	if (preset === "outline-card") {
		return [
			`background: ${bg}`,
			`border: 1px solid ${accent}`,
			"border-radius: 6px",
			"padding: 8pt 10pt",
		];
	}

	if (preset === "soft-fill") {
		return [
			`background: ${bg}`,
			"border: none",
			"border-left: none",
			"border-radius: 0",
			"padding: 8pt 12pt",
		];
	}

	const barWidth = kind === "callout" ? "4px" : kind === "embed" ? "2px" : "3px";
	return [
		`background: ${bg}`,
		`border: none`,
		`border-left: ${barWidth} solid ${accent}`,
		"border-radius: 4px",
		"padding: 6pt 10pt",
	];
}

/** Apply frame preset to a settings preview sample element. */
export function applyFramePreview(
	sample: HTMLElement,
	kind: FrameKind,
	style: ElementStyle,
): void {
	const preset: FramePreset = style.framePreset ?? "accent-bar";
	const bg = style.backgroundColor ?? DEFAULT_BG[kind];
	const accent = accentFor(kind, style);

	sample.style.background = bg;
	sample.style.padding = "6px 8px";

	if (preset === "outline-card") {
		sample.style.border = `1px solid ${accent}`;
		sample.style.borderRadius = "6px";
		return;
	}
	if (preset === "soft-fill") {
		sample.style.border = "none";
		sample.style.borderLeft = "none";
		sample.style.borderRadius = "0";
		sample.style.padding = "6px 10px";
		return;
	}
	const barWidth = kind === "callout" ? "4px" : kind === "embed" ? "2px" : "3px";
	sample.style.border = "none";
	sample.style.borderLeft = `${barWidth} solid ${accent}`;
	sample.style.borderRadius = "4px";
}
