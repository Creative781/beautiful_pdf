import type { ElementStyle, HrPreset } from "./types";

/** Print CSS extras for horizontal-rule presets (color + margins come from `rule`). */
export function hrStyleExtras(style: ElementStyle): string[] {
	const preset: HrPreset = style.hrPreset ?? "solid";
	const color = style.color || "#cccccc";

	const base = [
		"border: none",
		"background: transparent",
		"background-color: transparent",
	];

	switch (preset) {
		case "thick":
			return [...base, `border-top: 2.5px solid ${color}`, "height: 0"];
		case "double":
			return [...base, `border-top: 3px double ${color}`, "height: 0"];
		case "dashed":
			return [...base, `border-top: 1px dashed ${color}`, "height: 0"];
		case "fade":
			return [
				...base,
				"border-top: none",
				"height: 1px",
				`background: linear-gradient(to right, transparent 0%, ${color} 22%, ${color} 78%, transparent 100%)`,
			];
		case "short":
			return [
				...base,
				"border-top: none",
				"height: 2px",
				"width: 28%",
				"max-width: 120pt",
				"margin-left: auto",
				"margin-right: auto",
				`background: ${color}`,
				`background-color: ${color}`,
			];
		case "solid":
		default:
			return [...base, `border-top: 1px solid ${color}`, "height: 0"];
	}
}

/** Apply hr preset chrome to a settings preview sample. */
export function applyHrPreview(sample: HTMLElement, style: ElementStyle): void {
	const preset: HrPreset = style.hrPreset ?? "solid";
	for (const id of [
		"is-hr",
		"is-hr-solid",
		"is-hr-thick",
		"is-hr-double",
		"is-hr-dashed",
		"is-hr-fade",
		"is-hr-short",
	]) {
		sample.removeClass(id);
	}
	sample.addClass("is-hr");
	sample.addClass(`is-hr-${preset}`);
	sample.empty();
	const line = sample.createDiv({ cls: "beautiful-pdf-hr-line" });
	line.style.setProperty("--bpf-hr-color", style.color || "#cccccc");
}
