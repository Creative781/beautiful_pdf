import { App, Modal, Notice, TFile } from "obsidian";
import type BeautifulPdfPlugin from "./main";
import { getActiveProfile } from "./profiles";
import { renderNoteHtml } from "./render";
import {
	applyImageLayout,
	applyNoteImageLayouts,
	captureNoteImageLayouts,
	IMAGE_SIZE_PRESETS,
	nearestSizePreset,
	resetImageSizing,
	type ImageAlign,
	type ImageSizePreset,
	type NoteImageLayouts,
} from "./image-layout";
import type { PageSettings } from "./types";

/**
 * Optional step: set image width presets and block alignment for PDF.
 * No text-wrap floats (print engines are unreliable).
 */
export class ImageAdjustModal extends Modal {
	plugin: BeautifulPdfPlugin;
	file: TFile;
	private onApplied: (layouts: NoteImageLayouts) => void;
	private frameEl: HTMLIFrameElement | null = null;
	private statusEl: HTMLElement | null = null;
	private widthPxInput: HTMLInputElement | null = null;
	private activeIndex = 0;
	private detachFns: Array<() => void> = [];

	constructor(
		app: App,
		plugin: BeautifulPdfPlugin,
		file: TFile,
		onApplied: (layouts: NoteImageLayouts) => void,
	) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.onApplied = onApplied;
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass("beautiful-pdf-image-adjust-modal");
		contentEl.empty();

		contentEl.createEl("h2", { text: "Adjust images" });

		const tip = contentEl.createDiv({ cls: "beautiful-pdf-tip" });
		tip.setText(
			"Paper size matches the active profile. Click an image, then choose size and alignment (block only — no text wrap). Apply & preview PDF.",
		);

		const toolbar = contentEl.createDiv({ cls: "beautiful-pdf-toolbar" });
		const mkOn = (
			parent: HTMLElement,
			label: string,
			cls: string,
			fn: () => void,
		) => {
			const b = parent.createEl("button", {
				text: label,
				cls,
				attr: { type: "button" },
			});
			b.onclick = () => fn();
			return b;
		};

		const sizeBar = toolbar.createDiv({ cls: "beautiful-pdf-img-tool-group" });
		sizeBar.createSpan({ text: "Size", cls: "beautiful-pdf-img-tool-label" });
		for (const [id, label] of [
			["small", "S"],
			["medium", "M"],
			["large", "L"],
			["full", "Full"],
		] as [ImageSizePreset, string][]) {
			mkOn(sizeBar, label, "beautiful-pdf-img-size-btn", () => this.setSize(id));
		}
		this.widthPxInput = sizeBar.createEl("input", {
			cls: "beautiful-pdf-img-width-px",
			attr: {
				type: "number",
				min: "40",
				step: "1",
				placeholder: "px",
				title: "Width in pixels (relative to content column)",
				"aria-label": "Image width in pixels",
			},
		});
		sizeBar.createSpan({ text: "px", cls: "beautiful-pdf-img-tool-label" });
		this.widthPxInput.addEventListener("change", () => this.applyWidthPxInput());
		this.widthPxInput.addEventListener("keydown", (ev) => {
			if (ev.key === "Enter") {
				ev.preventDefault();
				this.applyWidthPxInput();
			}
		});

		const alignBar = toolbar.createDiv({ cls: "beautiful-pdf-img-tool-group" });
		alignBar.createSpan({ text: "Align", cls: "beautiful-pdf-img-tool-label" });
		for (const [id, label] of [
			["left", "Left"],
			["center", "Center"],
			["right", "Right"],
		] as [ImageAlign, string][]) {
			mkOn(alignBar, label, "beautiful-pdf-img-align-btn", () => this.setAlign(id));
		}

		mkOn(toolbar, "Reset image", "", () => this.resetActive());
		mkOn(toolbar, "Clear all", "", () => this.clearAll());
		mkOn(toolbar, "Apply & preview PDF", "mod-cta", () => void this.applyAndClose());

		this.statusEl = toolbar.createDiv({
			cls: "beautiful-pdf-status",
			text: "Loading…",
		});

		const wrap = contentEl.createDiv({ cls: "beautiful-pdf-image-adjust-frame" });
		this.frameEl = wrap.createEl("iframe", {
			attr: { title: "Image layout editor" },
		});

		void this.loadHtml();
	}

	onClose(): void {
		this.teardown();
		this.contentEl.empty();
	}

	private setStatus(text: string): void {
		this.statusEl?.setText(text);
	}

	private doc(): Document | null {
		return this.frameEl?.contentDocument ?? null;
	}

	private viewRoot(): HTMLElement | null {
		return (
			(this.doc()?.querySelector(
				".bpf-paper .markdown-preview-view",
			) as HTMLElement | null) ?? null
		);
	}

	private imgs(): HTMLImageElement[] {
		const root = this.viewRoot();
		if (!root) return [];
		return Array.from(root.querySelectorAll("img"));
	}

	private async loadHtml(): Promise<void> {
		try {
			const profile = getActiveProfile(this.plugin.settings);
			const saved = this.plugin.settings.imageLayouts?.[this.file.path] ?? null;
			const rendered = await renderNoteHtml(this.app, this.file, profile, {
				tableLayouts: null,
				imageLayouts: null,
			});

			const page = profile.page;
			const { pageWidthMm, pageHeightMm, contentWidthMm } = pageMetrics(page);
			const label = `${page.pageSize === "Custom" ? "Custom" : page.pageSize} ${pageWidthMm}×${pageHeightMm} mm · content ${contentWidthMm.toFixed(1)} mm`;

			const editorCss = `
${rendered.css}
html, body {
  margin: 0;
  padding: 16px;
  background: #e5e7eb;
}
.bpf-paper-meta {
  max-width: ${pageWidthMm}mm;
  margin: 0 auto 10px;
  font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #4b5563;
}
.bpf-paper {
  width: ${pageWidthMm}mm;
  min-height: ${pageHeightMm}mm;
  margin: 0 auto 24px;
  background: #fff;
  box-sizing: border-box;
  padding: ${page.marginTopMm}mm ${page.marginRightMm}mm ${page.marginBottomMm}mm ${page.marginLeftMm}mm;
  box-shadow: 0 1px 4px rgba(0,0,0,0.14);
  overflow: hidden;
}
.bpf-paper .markdown-preview-view {
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  box-sizing: border-box !important;
}
img {
  cursor: pointer;
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-color 0.12s ease;
}
img.bpf-img-active {
  outline-color: #2563eb;
}
img.bpf-img-sized {
  outline-color: rgba(37, 99, 235, 0.35);
}
img.bpf-img-sized.bpf-img-active {
  outline-color: #2563eb;
}
`;

			const bodyInner =
				rendered.htmlDocument.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ??
				`<div class="markdown-preview-view markdown-rendered">${rendered.bodyHtml}</div>`;

			const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${editorCss}</style></head>
<body>
<div class="bpf-paper-meta">${label}</div>
<div class="bpf-paper">${bodyInner}</div>
</body></html>`;

			if (!this.frameEl) return;
			this.frameEl.srcdoc = html;
			await new Promise<void>((resolve) => {
				if (!this.frameEl) {
					resolve();
					return;
				}
				this.frameEl.onload = () => resolve();
			});

			const view = this.viewRoot();
			if (view && saved?.images?.length) {
				applyNoteImageLayouts(view, saved);
			}

			this.wireImages();
			const n = this.imgs().length;
			this.setStatus(
				n === 0
					? "No images in this note"
					: `${n} image${n === 1 ? "" : "s"} · click to select · size & align`,
			);
			if (n > 0) this.selectIndex(0);
		} catch (err) {
			console.error(err);
			this.setStatus("Failed to load");
			new Notice(`Image adjust failed: ${String(err)}`);
		}
	}

	private teardown(): void {
		for (const fn of this.detachFns) fn();
		this.detachFns = [];
	}

	private wireImages(): void {
		this.teardown();
		const imgs = this.imgs();
		imgs.forEach((img, i) => {
			const onClick = (ev: MouseEvent) => {
				ev.preventDefault();
				ev.stopPropagation();
				this.selectIndex(i);
			};
			img.addEventListener("click", onClick);
			this.detachFns.push(() => img.removeEventListener("click", onClick));
		});
	}

	private contentWidthPx(): number {
		const view = this.viewRoot();
		return Math.max(1, view?.clientWidth || view?.getBoundingClientRect().width || 1);
	}

	private selectIndex(i: number): void {
		const imgs = this.imgs();
		if (!imgs[i]) return;
		this.activeIndex = i;
		imgs.forEach((img, j) => {
			img.classList.toggle("bpf-img-active", j === i);
		});
		const img = imgs[i];
		const pct = parseFloat(img.style.width) || IMAGE_SIZE_PRESETS.medium;
		const align = (img.dataset.bpfAlign as ImageAlign) || "center";
		const preset = nearestSizePreset(pct);
		const px = Math.round((pct / 100) * this.contentWidthPx());
		if (this.widthPxInput) this.widthPxInput.value = String(px);
		this.setStatus(
			`Image ${i + 1}/${imgs.length} · ${Math.round(pct)}% (${px}px) · ${align}` +
				(Math.abs(IMAGE_SIZE_PRESETS[preset] - pct) < 0.6 ? ` · ${preset}` : ""),
		);
	}

	private activeImg(): HTMLImageElement | null {
		return this.imgs()[this.activeIndex] ?? null;
	}

	private setSize(preset: ImageSizePreset): void {
		const img = this.activeImg();
		if (!img) return;
		const align = (img.dataset.bpfAlign as ImageAlign) || "center";
		applyImageLayout(img, {
			widthPct: IMAGE_SIZE_PRESETS[preset],
			align,
		});
		this.selectIndex(this.activeIndex);
	}

	private applyWidthPxInput(): void {
		const raw = this.widthPxInput?.value?.trim() ?? "";
		const px = parseFloat(raw);
		if (!Number.isFinite(px) || px <= 0) {
			new Notice("Enter a positive width in pixels.");
			this.selectIndex(this.activeIndex);
			return;
		}
		this.setWidthPx(px);
	}

	private setWidthPx(widthPx: number): void {
		const img = this.activeImg();
		if (!img) return;
		const contentW = this.contentWidthPx();
		const pct = Math.min(100, Math.max(5, (widthPx / contentW) * 100));
		const align = (img.dataset.bpfAlign as ImageAlign) || "center";
		applyImageLayout(img, { widthPct: pct, align });
		this.selectIndex(this.activeIndex);
	}

	private setAlign(align: ImageAlign): void {
		const img = this.activeImg();
		if (!img) return;
		const pct =
			parseFloat(img.style.width) ||
			IMAGE_SIZE_PRESETS[nearestSizePreset(55)];
		applyImageLayout(img, { widthPct: pct, align });
		this.selectIndex(this.activeIndex);
	}

	private resetActive(): void {
		const img = this.activeImg();
		if (!img) return;
		resetImageSizing(img);
		this.selectIndex(this.activeIndex);
		this.setStatus(`Image ${this.activeIndex + 1} · reset`);
	}

	private clearAll(): void {
		for (const img of this.imgs()) resetImageSizing(img);
		if (this.plugin.settings.imageLayouts) {
			delete this.plugin.settings.imageLayouts[this.file.path];
		}
		void this.plugin.saveSettings();
		this.setStatus("All image sizing cleared");
	}

	private async applyAndClose(): Promise<void> {
		const root = this.viewRoot();
		if (!root) {
			new Notice("Beautiful PDF: image editor DOM not ready");
			return;
		}
		const layouts = captureNoteImageLayouts(root);
		if (!this.plugin.settings.imageLayouts) {
			this.plugin.settings.imageLayouts = {};
		}
		if (layouts.images.length === 0) {
			delete this.plugin.settings.imageLayouts[this.file.path];
		} else {
			this.plugin.settings.imageLayouts[this.file.path] = JSON.parse(
				JSON.stringify(layouts),
			) as NoteImageLayouts;
		}
		await this.plugin.saveSettings();
		const saved =
			this.plugin.settings.imageLayouts?.[this.file.path] ??
			({ images: [] } as NoteImageLayouts);
		const callback = this.onApplied;
		this.close();
		callback(saved);
		new Notice(
			saved.images.length
				? `Saved layout for ${saved.images.length} image(s)`
				: "No custom image sizing to save",
		);
	}
}

function pageMetrics(page: PageSettings): {
	pageWidthMm: number;
	pageHeightMm: number;
	contentWidthMm: number;
} {
	const pageWidthMm =
		page.pageSize === "Custom"
			? page.pageWidthMm
			: page.pageSize === "Letter" || page.pageSize === "Legal"
				? 215.9
				: 210;
	const pageHeightMm =
		page.pageSize === "Custom"
			? page.pageHeightMm
			: page.pageSize === "Letter"
				? 279.4
				: page.pageSize === "Legal"
					? 355.6
					: 297;
	const contentWidthMm = Math.max(
		40,
		pageWidthMm - page.marginLeftMm - page.marginRightMm,
	);
	return { pageWidthMm, pageHeightMm, contentWidthMm };
}

export function imageLayoutsForFile(
	plugin: BeautifulPdfPlugin,
	file: TFile,
): NoteImageLayouts | null {
	return plugin.settings.imageLayouts?.[file.path] ?? null;
}

export function imageAdjustEnabled(plugin: BeautifulPdfPlugin): boolean {
	return getActiveProfile(plugin.settings).special.enableImageAdjust !== false;
}

export function imageLayoutsForExport(
	plugin: BeautifulPdfPlugin,
	file: TFile,
): NoteImageLayouts | null {
	if (!imageAdjustEnabled(plugin)) return null;
	return imageLayoutsForFile(plugin, file);
}
