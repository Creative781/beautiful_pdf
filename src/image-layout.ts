/** Per-image size/alignment saved from the optional Adjust images step. */
export type ImageAlign = "left" | "center" | "right";

export type ImageSizePreset = "small" | "medium" | "large" | "full";

export const IMAGE_SIZE_PRESETS: Record<ImageSizePreset, number> = {
	small: 35,
	medium: 55,
	large: 75,
	full: 100,
};

export interface ImageLayout {
	/** 0-based index among `img` elements in document order. */
	index: number;
	/** Width as % of the PDF content column. */
	widthPct: number;
	align: ImageAlign;
}

export interface NoteImageLayouts {
	images: ImageLayout[];
}

export function emptyNoteImageLayouts(): NoteImageLayouts {
	return { images: [] };
}

export function nearestSizePreset(widthPct: number): ImageSizePreset {
	const entries = Object.entries(IMAGE_SIZE_PRESETS) as [ImageSizePreset, number][];
	let best: ImageSizePreset = "medium";
	let bestDist = Infinity;
	for (const [id, pct] of entries) {
		const d = Math.abs(pct - widthPct);
		if (d < bestDist) {
			bestDist = d;
			best = id;
		}
	}
	return best;
}

export function markImageTouched(img: HTMLImageElement): void {
	img.dataset.bpfImgTouched = "1";
	img.classList.add("bpf-img-sized");
}

export function applyImageLayout(
	img: HTMLImageElement,
	layout: Pick<ImageLayout, "widthPct" | "align">,
): void {
	markImageTouched(img);
	const pct = Math.min(100, Math.max(5, layout.widthPct));
	img.style.width = `${pct}%`;
	img.style.maxWidth = `${pct}%`;
	img.style.height = "auto";
	img.style.display = "block";
	if (layout.align === "center") {
		img.style.marginLeft = "auto";
		img.style.marginRight = "auto";
	} else if (layout.align === "right") {
		img.style.marginLeft = "auto";
		img.style.marginRight = "0";
	} else {
		img.style.marginLeft = "0";
		img.style.marginRight = "auto";
	}
	img.dataset.bpfAlign = layout.align;
}

/** Apply saved layouts onto rendered note HTML (by image index). */
export function applyNoteImageLayouts(
	root: HTMLElement,
	layouts: NoteImageLayouts | null | undefined,
): void {
	if (!layouts?.images?.length) return;
	const imgs = Array.from(root.querySelectorAll("img"));
	for (const layout of layouts.images) {
		const img = imgs[layout.index];
		if (!img) continue;
		img.setAttribute("data-bpf-img", String(layout.index));
		applyImageLayout(img, layout);
	}
}

/** Print/PDF CSS that forces saved image layouts. */
export function imageLayoutsToCss(
	layouts: NoteImageLayouts | null | undefined,
): string {
	if (!layouts?.images?.length) return "";
	const lines: string[] = [];
	for (const layout of layouts.images) {
		const t = `img[data-bpf-img="${layout.index}"]`;
		const pct = Math.min(100, Math.max(5, layout.widthPct));
		let ml = "0";
		let mr = "auto";
		if (layout.align === "center") {
			ml = "auto";
			mr = "auto";
		} else if (layout.align === "right") {
			ml = "auto";
			mr = "0";
		}
		lines.push(
			`${t}{width:${pct}% !important;max-width:${pct}% !important;height:auto !important;display:block !important;margin-left:${ml} !important;margin-right:${mr} !important;}`,
		);
	}
	return lines.join("\n");
}

function imageHasCustomSizing(img: HTMLImageElement): boolean {
	if (img.dataset.bpfImgTouched === "1") return true;
	if (img.classList.contains("bpf-img-sized")) return true;
	if (img.style.width || img.dataset.bpfAlign) return true;
	return false;
}

export function measureImageWidthPct(
	img: HTMLImageElement,
	contentWidthPx: number,
): number {
	const parent =
		(img.closest(".markdown-preview-view") as HTMLElement | null) ??
		img.parentElement;
	const pw =
		contentWidthPx ||
		parent?.clientWidth ||
		parent?.getBoundingClientRect().width ||
		1;
	const styleW = img.style.width;
	if (styleW.endsWith("%")) {
		const p = parseFloat(styleW);
		if (Number.isFinite(p) && p > 0) return Math.min(100, Math.max(5, p));
	}
	const tw = img.getBoundingClientRect().width;
	return Math.min(100, Math.max(5, (tw / pw) * 100));
}

export function captureNoteImageLayouts(
	root: HTMLElement,
	contentWidthPx?: number,
): NoteImageLayouts {
	const imgs = Array.from(root.querySelectorAll("img")) as HTMLImageElement[];
	const parent = root.querySelector(".markdown-preview-view") as HTMLElement | null;
	const pw =
		contentWidthPx ??
		parent?.clientWidth ??
		root.clientWidth ??
		800;
	const snapshots: ImageLayout[] = [];
	imgs.forEach((img, index) => {
		if (!imageHasCustomSizing(img)) return;
		const align = (img.dataset.bpfAlign as ImageAlign) || inferAlign(img);
		snapshots.push({
			index,
			widthPct: measureImageWidthPct(img, pw),
			align,
		});
	});
	return { images: snapshots };
}

function inferAlign(img: HTMLImageElement): ImageAlign {
	const ml = img.style.marginLeft;
	const mr = img.style.marginRight;
	if (ml === "auto" && mr === "auto") return "center";
	if (ml === "auto") return "right";
	return "left";
}

export function resetImageSizing(img: HTMLImageElement): void {
	img.classList.remove("bpf-img-sized");
	delete img.dataset.bpfImgTouched;
	delete img.dataset.bpfAlign;
	img.removeAttribute("data-bpf-img");
	img.style.width = "";
	img.style.maxWidth = "";
	img.style.height = "";
	img.style.display = "";
	img.style.marginLeft = "";
	img.style.marginRight = "";
}
