import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { exportPdfToFile, generatePdf } from "./export";
import type BeautifulPdfPlugin from "./main";
import { getActiveProfile } from "./profiles";
import {
	imageLayoutsForExport,
	ImageAdjustModal,
	imageAdjustEnabled,
} from "./image-editor";
import type { NoteImageLayouts } from "./image-layout";
import { layoutsForExport, TableAdjustModal, tableAdjustEnabled } from "./table-editor";
import type { NoteTableLayouts } from "./table-layout";
import type { Profile } from "./types";

export interface PreviewLayoutOverrides {
	tableLayouts?: NoteTableLayouts | null;
	imageLayouts?: NoteImageLayouts | null;
}

export class PreviewModal extends Modal {
	plugin: BeautifulPdfPlugin;
	file: TFile;
	private iframeEl: HTMLIFrameElement | null = null;
	private statusEl: HTMLElement | null = null;
	private blobUrl: string | null = null;
	/** Incremented on each refresh so an older generate cannot overwrite a newer one. */
	private genToken = 0;
	private initialLayouts: PreviewLayoutOverrides | undefined;

	constructor(
		app: App,
		plugin: BeautifulPdfPlugin,
		file: TFile,
		initialLayouts?: PreviewLayoutOverrides,
	) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.initialLayouts = initialLayouts;
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass("beautiful-pdf-preview-modal");
		contentEl.empty();

		contentEl.createEl("h2", { text: "Beautiful PDF preview" });

		const toolbar = contentEl.createDiv({ cls: "beautiful-pdf-toolbar" });

		const select = toolbar.createEl("select");
		for (const p of this.plugin.settings.profiles) {
			const opt = select.createEl("option", { text: p.name, value: p.id });
			if (p.id === this.plugin.settings.activeProfileId) opt.selected = true;
		}
		select.onchange = async () => {
			this.plugin.settings.activeProfileId = select.value;
			await this.plugin.saveSettings();
			await this.refresh();
		};

		const refreshBtn = toolbar.createEl("button", { text: "Refresh" });
		refreshBtn.onclick = () => void this.refresh();

		if (tableAdjustEnabled(this.plugin)) {
			const adjustBtn = toolbar.createEl("button", { text: "Adjust tables…" });
			adjustBtn.onclick = () => {
				new TableAdjustModal(this.app, this.plugin, this.file, (layouts) => {
					void this.refresh({ tableLayouts: layouts });
				}).open();
			};
		}

		if (imageAdjustEnabled(this.plugin)) {
			const adjustImgBtn = toolbar.createEl("button", {
				text: "Adjust images…",
			});
			adjustImgBtn.onclick = () => {
				new ImageAdjustModal(this.app, this.plugin, this.file, (layouts) => {
					void this.refresh({ imageLayouts: layouts });
				}).open();
			};
		}

		const saveBtn = toolbar.createEl("button", {
			text: "Save PDF",
			cls: "mod-cta",
		});
		saveBtn.onclick = async () => {
			const profile = getActiveProfile(this.plugin.settings);
			await exportPdfToFile(this.app, this.file, profile, true, {
				tableLayouts: layoutsForExport(this.plugin, this.file),
				imageLayouts: imageLayoutsForExport(this.plugin, this.file),
			});
		};

		this.statusEl = toolbar.createDiv({ cls: "beautiful-pdf-status", text: "" });

		const wrap = contentEl.createDiv({ cls: "beautiful-pdf-frame-wrap" });
		this.iframeEl = wrap.createEl("iframe", {
			attr: { title: "PDF preview" },
		});

		if (this.initialLayouts !== undefined) {
			void this.refresh(this.initialLayouts);
			this.initialLayouts = undefined;
		} else {
			void this.refresh();
		}
	}

	/**
	 * @param override When provided, merge with saved layouts for the other kind.
	 */
	async refresh(override?: PreviewLayoutOverrides): Promise<void> {
		const token = ++this.genToken;
		this.setStatus("Generating PDF…");
		try {
			const profile = getActiveProfile(this.plugin.settings);
			const tableLayouts = tableAdjustEnabled(this.plugin)
				? override && "tableLayouts" in override
					? override.tableLayouts ?? null
					: layoutsForExport(this.plugin, this.file)
				: null;
			const imageLayouts = imageAdjustEnabled(this.plugin)
				? override && "imageLayouts" in override
					? override.imageLayouts ?? null
					: imageLayoutsForExport(this.plugin, this.file)
				: null;
			const { data } = await generatePdf(this.app, this.file, profile, {
				tableLayouts,
				imageLayouts,
			});
			if (token !== this.genToken) return;
			this.showPdf(data);
			const notes: string[] = [];
			if (tableLayouts?.tables?.length) {
				notes.push(`${tableLayouts.tables.length} custom table(s)`);
			}
			if (imageLayouts?.images?.length) {
				notes.push(`${imageLayouts.images.length} custom image(s)`);
			}
			const layoutNote = notes.length ? ` · ${notes.join(" · ")}` : "";
			this.setStatus(`Profile: ${profile.name}${layoutNote}`);
		} catch (err) {
			if (token !== this.genToken) return;
			console.error(err);
			this.setStatus("Failed");
			new Notice(`Preview failed: ${String(err)}`);
		}
	}

	private showPdf(data: Uint8Array): void {
		if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
		const blob = new Blob([data], { type: "application/pdf" });
		this.blobUrl = URL.createObjectURL(blob);
		if (this.iframeEl) {
			this.iframeEl.src = this.blobUrl;
		}
	}

	private setStatus(text: string): void {
		if (this.statusEl) this.statusEl.setText(text);
	}

	onClose(): void {
		if (this.blobUrl) URL.revokeObjectURL(this.blobUrl);
		this.contentEl.empty();
	}
}

export class ProfileSuggestModal extends Modal {
	plugin: BeautifulPdfPlugin;
	file: TFile;
	onChoose: (profile: Profile) => void;

	constructor(
		app: App,
		plugin: BeautifulPdfPlugin,
		file: TFile,
		onChoose: (profile: Profile) => void,
	) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.onChoose = onChoose;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Choose profile" });

		for (const profile of this.plugin.settings.profiles) {
			new Setting(contentEl).setName(profile.name).addButton((btn) =>
				btn.setButtonText("Export").onClick(() => {
					this.close();
					this.onChoose(profile);
				}),
			);
		}
	}
}
