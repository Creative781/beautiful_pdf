import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { exportPdfToFile, generatePdf } from "./export";
import type BeautifulPdfPlugin from "./main";
import { getActiveProfile } from "./profiles";
import { layoutsForFile, TableAdjustModal } from "./table-editor";
import type { NoteTableLayouts } from "./table-layout";
import type { Profile } from "./types";

export class PreviewModal extends Modal {
	plugin: BeautifulPdfPlugin;
	file: TFile;
	private iframeEl: HTMLIFrameElement | null = null;
	private statusEl: HTMLElement | null = null;
	private blobUrl: string | null = null;
	/** Incremented on each refresh so an older generate cannot overwrite a newer one. */
	private genToken = 0;
	private initialLayouts: NoteTableLayouts | null | undefined;

	constructor(
		app: App,
		plugin: BeautifulPdfPlugin,
		file: TFile,
		initialLayouts?: NoteTableLayouts | null,
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

		const adjustBtn = toolbar.createEl("button", { text: "Adjust tables…" });
		adjustBtn.onclick = () => {
			new TableAdjustModal(this.app, this.plugin, this.file, (layouts) => {
				void this.refresh(layouts);
			}).open();
		};

		const saveBtn = toolbar.createEl("button", {
			text: "Save PDF",
			cls: "mod-cta",
		});
		saveBtn.onclick = async () => {
			const profile = getActiveProfile(this.plugin.settings);
			await exportPdfToFile(this.app, this.file, profile, true, {
				tableLayouts: layoutsForFile(this.plugin, this.file),
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
	 * @param layoutsOverride When provided (including null), use this instead of
	 *   reading saved settings — required right after Adjust tables.
	 */
	async refresh(layoutsOverride?: NoteTableLayouts | null): Promise<void> {
		const token = ++this.genToken;
		this.setStatus("Generating PDF…");
		try {
			const profile = getActiveProfile(this.plugin.settings);
			const layouts =
				arguments.length >= 1
					? layoutsOverride
					: layoutsForFile(this.plugin, this.file);
			const { data } = await generatePdf(this.app, this.file, profile, {
				tableLayouts: layouts,
			});
			if (token !== this.genToken) return;
			this.showPdf(data);
			const layoutNote = layouts?.tables?.length
				? ` · ${layouts.tables.length} custom table(s)`
				: "";
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
