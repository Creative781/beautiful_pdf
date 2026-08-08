import { App, Modal, Notice, Setting, TFile } from "obsidian";
import { exportPdfToFile, generatePdf } from "./export";
import type BeautifulPdfPlugin from "./main";
import { getActiveProfile } from "./profiles";
import type { Profile } from "./types";

export class PreviewModal extends Modal {
	plugin: BeautifulPdfPlugin;
	file: TFile;
	private iframeEl: HTMLIFrameElement | null = null;
	private statusEl: HTMLElement | null = null;
	private blobUrl: string | null = null;
	private generating = false;

	constructor(app: App, plugin: BeautifulPdfPlugin, file: TFile) {
		super(app);
		this.plugin = plugin;
		this.file = file;
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass("beautiful-pdf-preview-modal");
		contentEl.empty();

		contentEl.createEl("h2", { text: "Beautiful PDF 미리보기" });

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

		const refreshBtn = toolbar.createEl("button", { text: "새로고침" });
		refreshBtn.onclick = () => void this.refresh();

		const saveBtn = toolbar.createEl("button", {
			text: "PDF로 저장",
			cls: "mod-cta",
		});
		saveBtn.onclick = async () => {
			const profile = getActiveProfile(this.plugin.settings);
			await exportPdfToFile(this.app, this.file, profile);
		};

		this.statusEl = toolbar.createDiv({ cls: "beautiful-pdf-status", text: "" });

		const wrap = contentEl.createDiv({ cls: "beautiful-pdf-frame-wrap" });
		this.iframeEl = wrap.createEl("iframe", {
			attr: { title: "PDF preview" },
		});

		void this.refresh();
	}

	async refresh(): Promise<void> {
		if (this.generating) return;
		this.generating = true;
		this.setStatus("PDF 생성 중…");
		try {
			const profile = getActiveProfile(this.plugin.settings);
			const { data } = await generatePdf(this.app, this.file, profile);
			this.showPdf(data);
			this.setStatus(`프로필: ${profile.name}`);
		} catch (err) {
			console.error(err);
			this.setStatus("생성 실패");
			new Notice(`미리보기 실패: ${String(err)}`);
		} finally {
			this.generating = false;
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
		contentEl.createEl("h2", { text: "프로필 선택" });
		for (const profile of this.plugin.settings.profiles) {
			new Setting(contentEl).setName(profile.name).addButton((btn) =>
				btn
					.setButtonText("선택")
					.setCta()
					.onClick(() => {
						this.close();
						this.onChoose(profile);
					}),
			);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
