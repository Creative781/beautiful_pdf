import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { exportPdfToFile } from "./export";
import { PreviewModal, ProfileSuggestModal } from "./preview";
import { createDefaultSettings, createSampleProfiles, getActiveProfile } from "./profiles";
import { BeautifulPdfSettingTab } from "./settings";
import type { BeautifulPdfSettings, ElementStyles, Profile } from "./types";
import { ELEMENT_KEYS, SETTINGS_VERSION } from "./types";
import { PAGE_BREAK_SNIPPET, toLineHeightPercent } from "./util";

export default class BeautifulPdfPlugin extends Plugin {
	settings: BeautifulPdfSettings;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addSettingTab(new BeautifulPdfSettingTab(this.app, this));

		this.addRibbonIcon("file-text", "Beautiful PDF preview", () => {
			void this.openPreview();
		});

		this.addCommand({
			id: "beautiful-pdf-preview",
			name: "Preview current note as PDF",
			checkCallback: (checking) => {
				const file = this.getActiveMarkdownFile();
				if (!file) return false;
				if (!checking) void this.openPreview(file);
				return true;
			},
		});

		this.addCommand({
			id: "beautiful-pdf-export",
			name: "Export current note to PDF",
			checkCallback: (checking) => {
				const file = this.getActiveMarkdownFile();
				if (!file) return false;
				if (!checking) {
					const profile = getActiveProfile(this.settings);
					void exportPdfToFile(this.app, file, profile);
				}
				return true;
			},
		});

		this.addCommand({
			id: "beautiful-pdf-export-with-profile",
			name: "Export current note with profile…",
			checkCallback: (checking) => {
				const file = this.getActiveMarkdownFile();
				if (!file) return false;
				if (!checking) {
					new ProfileSuggestModal(this.app, this, file, (profile) => {
						void exportPdfToFile(this.app, file, profile);
					}).open();
				}
				return true;
			},
		});

		this.addCommand({
			id: "beautiful-pdf-insert-pagebreak",
			name: "Insert page break",
			editorCallback: (editor) => {
				const pos = editor.getCursor();
				const line = editor.getLine(pos.line);
				const needsLeadingNewline = pos.ch > 0 || (line.length > 0 && pos.ch === line.length);
				const snippet = needsLeadingNewline
					? `\n${PAGE_BREAK_SNIPPET}`
					: PAGE_BREAK_SNIPPET;
				editor.replaceRange(snippet, pos);
			},
		});

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file) => {
				if (!(file instanceof TFile) || file.extension !== "md") return;
				menu.addItem((item) => {
					item
						.setTitle("Beautiful PDF: Export")
						.setIcon("file-text")
						.onClick(() => {
							const profile = getActiveProfile(this.settings);
							void exportPdfToFile(this.app, file, profile);
						});
				});
				menu.addItem((item) => {
					item
						.setTitle("Beautiful PDF: Preview")
						.setIcon("eye")
						.onClick(() => {
							void this.openPreview(file);
						});
				});
			}),
		);
	}

	async openPreview(file?: TFile): Promise<void> {
		const target = file ?? this.getActiveMarkdownFile();
		if (!target) {
			new Notice("Open a Markdown note first.");
			return;
		}
		new PreviewModal(this.app, this, target).open();
	}

	getActiveMarkdownFile(): TFile | null {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		return view?.file ?? null;
	}

	async loadSettings(): Promise<void> {
		const defaults = createDefaultSettings();
		const data = (await this.loadData()) as Partial<BeautifulPdfSettings> | null;
		if (!data || !Array.isArray(data.profiles) || data.profiles.length === 0) {
			this.settings = defaults;
			await this.saveSettings();
			return;
		}

		const sampleIds = new Set(["report", "life", "plan"]);
		let profiles = data.profiles;
		const version = data.settingsVersion ?? 1;
		if (version < SETTINGS_VERSION) {
			const custom = profiles.filter((p) => !sampleIds.has(p.id));
			profiles = [...createSampleProfiles(), ...custom];
		}

		const fallbackElements = defaults.profiles[0].elements;
		this.settings = {
			settingsVersion: SETTINGS_VERSION,
			activeProfileId: data.activeProfileId ?? defaults.activeProfileId,
			profiles: profiles.map((p) => mergeProfile(p, fallbackElements)),
		};
		if (!this.settings.profiles.some((p) => p.id === this.settings.activeProfileId)) {
			this.settings.activeProfileId = this.settings.profiles[0].id;
		}
		if (version < SETTINGS_VERSION) {
			await this.saveSettings();
		}
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}

function mergeProfile(raw: Profile, fallback: ElementStyles): Profile {
	const elements = { ...fallback } as ElementStyles;
	for (const key of ELEMENT_KEYS) {
		if (raw.elements?.[key]) {
			const merged = { ...fallback[key], ...raw.elements[key] };
			if (merged.lineHeight != null) {
				merged.lineHeight = toLineHeightPercent(merged.lineHeight, fallback[key].lineHeight ?? 170);
			}
			elements[key] = merged;
		}
	}
	const defaultPage = createDefaultSettings().profiles[0].page;
	const page = { ...defaultPage, ...raw.page };
	page.lineHeight = toLineHeightPercent(page.lineHeight, defaultPage.lineHeight);
	return {
		id: raw.id,
		name: raw.name,
		page,
		elements,
	};
}
