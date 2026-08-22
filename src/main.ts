import { MarkdownView, Notice, Plugin, TFile } from "obsidian";
import { exportPdfToFile } from "./export";
import { PreviewModal, ProfileSuggestModal } from "./preview";
import { createDefaultSettings, createSampleProfiles, getActiveProfile } from "./profiles";
import { BeautifulPdfSettingTab } from "./settings";
import { layoutsForExport, TableAdjustModal, tableAdjustEnabled } from "./table-editor";
import {
	imageLayoutsForExport,
	ImageAdjustModal,
	imageAdjustEnabled,
} from "./image-editor";
import type { BeautifulPdfSettings, ElementStyles, Profile } from "./types";
import { createDefaultSpecialOptions, ELEMENT_KEYS, SETTINGS_VERSION } from "./types";
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
			id: "preview",
			name: "Preview current note as PDF",
			checkCallback: (checking) => {
				const file = this.getActiveMarkdownFile();
				if (!file) return false;
				if (!checking) void this.openPreview(file);
				return true;
			},
		});

		this.addCommand({
			id: "adjust-tables",
			name: "Adjust tables for PDF…",
			checkCallback: (checking) => {
				if (!tableAdjustEnabled(this)) return false;
				const file = this.getActiveMarkdownFile();
				if (!file) return false;
				if (!checking) {
					new TableAdjustModal(this.app, this, file, (layouts) => {
						new PreviewModal(this.app, this, file, {
							tableLayouts: layouts,
						}).open();
					}).open();
				}
				return true;
			},
		});

		this.addCommand({
			id: "adjust-images",
			name: "Adjust images for PDF…",
			checkCallback: (checking) => {
				if (!imageAdjustEnabled(this)) return false;
				const file = this.getActiveMarkdownFile();
				if (!file) return false;
				if (!checking) {
					new ImageAdjustModal(this.app, this, file, (layouts) => {
						new PreviewModal(this.app, this, file, {
							imageLayouts: layouts,
						}).open();
					}).open();
				}
				return true;
			},
		});

		this.addCommand({
			id: "export",
			name: "Export current note to PDF",
			checkCallback: (checking) => {
				const file = this.getActiveMarkdownFile();
				if (!file) return false;
				if (!checking) {
					const profile = getActiveProfile(this.settings);
					void exportPdfToFile(this.app, file, profile, true, {
						tableLayouts: layoutsForExport(this, file),
						imageLayouts: imageLayoutsForExport(this, file),
					});
				}
				return true;
			},
		});

		this.addCommand({
			id: "export-with-profile",
			name: "Export current note with profile…",
			checkCallback: (checking) => {
				const file = this.getActiveMarkdownFile();
				if (!file) return false;
				if (!checking) {
					new ProfileSuggestModal(this.app, this, file, (profile) => {
						void exportPdfToFile(this.app, file, profile, true, {
							tableLayouts: layoutsForExport(this, file),
							imageLayouts: imageLayoutsForExport(this, file),
						});
					}).open();
				}
				return true;
			},
		});

		this.addCommand({
			id: "insert-pagebreak",
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
							void exportPdfToFile(this.app, file, profile, true, {
								tableLayouts: layoutsForExport(this, file),
								imageLayouts: imageLayoutsForExport(this, file),
							});
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
				if (tableAdjustEnabled(this)) {
					menu.addItem((item) => {
						item
							.setTitle("Beautiful PDF: Adjust tables…")
							.setIcon("table")
							.onClick(() => {
								new TableAdjustModal(this.app, this, file, (layouts) => {
									new PreviewModal(this.app, this, file, {
										tableLayouts: layouts,
									}).open();
								}).open();
							});
					});
				}
				if (imageAdjustEnabled(this)) {
					menu.addItem((item) => {
						item
							.setTitle("Beautiful PDF: Adjust images…")
							.setIcon("image")
							.onClick(() => {
								new ImageAdjustModal(this.app, this, file, (layouts) => {
									new PreviewModal(this.app, this, file, {
										imageLayouts: layouts,
									}).open();
								}).open();
							});
					});
				}
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
			tableLayouts: data.tableLayouts ?? {},
			imageLayouts: data.imageLayouts ?? {},
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
	const elements: ElementStyles = { ...fallback };
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
	migrateLegacyHeaderFooter(raw.page as Record<string, unknown>, page);
	const special = createDefaultSpecialOptions(raw.special);
	special.orderedListHeadingLevel1 = clampLevel(special.orderedListHeadingLevel1, 2);
	special.orderedListHeadingLevel2 = clampLevel(special.orderedListHeadingLevel2, 3);
	special.orderedListHeadingLevel3 = clampLevel(special.orderedListHeadingLevel3, 4);
	return {
		id: raw.id,
		name: raw.name,
		page,
		elements,
		special,
	};
}

function clampLevel(n: number, fallback: number): number {
	if (!Number.isFinite(n)) return fallback;
	return Math.min(6, Math.max(1, Math.round(n)));
}

function migrateLegacyString(value: unknown, fallback: string): string {
	if (typeof value === "string") return value.trim();
	if (value == null) return fallback;
	return fallback;
}

/** Map old page-number + single header/footer fields onto the 3-slot model. */
function migrateLegacyHeaderFooter(
	raw: Record<string, unknown> | undefined,
	page: Profile["page"],
): void {
	if (!raw) return;
	const hasNew =
		raw.headerLeft != null ||
		raw.headerCenter != null ||
		raw.headerRight != null ||
		raw.footerLeft != null ||
		raw.footerCenter != null ||
		raw.footerRight != null;
	if (hasNew) {
		stripLegacyPageKeys(page as unknown as Record<string, unknown>);
		return;
	}

	page.headerLeft = "";
	page.headerCenter = "";
	page.headerRight = "";
	page.footerLeft = "";
	page.footerCenter = "";
	page.footerRight = "";

	const headerText = migrateLegacyString(raw.headerText, "");
	if (headerText) {
		const align = migrateLegacyString(raw.headerAlign, "left");
		if (align === "center") page.headerCenter = headerText;
		else if (align === "right") page.headerRight = headerText;
		else page.headerLeft = headerText;
	}

	const footerText = migrateLegacyString(raw.footerText, "");
	if (footerText) {
		const align = migrateLegacyString(raw.footerAlign, "center");
		if (align === "left") page.footerLeft = footerText;
		else if (align === "right") page.footerRight = footerText;
		else page.footerCenter = footerText;
	}

	const pn = migrateLegacyString(raw.pageNumber, "none");
	const fmt = migrateLegacyString(raw.pageNumberFormat, "{page}")
		.replace(/\{page\}/g, "{{page}}")
		.replace(/\{pages\}/g, "{{pages}}");
	if (pn === "top-center") {
		page.headerCenter = joinSlot(page.headerCenter, fmt);
	} else if (pn === "bottom-center") {
		page.footerCenter = joinSlot(page.footerCenter, fmt);
	} else if (pn === "bottom-right") {
		page.footerRight = joinSlot(page.footerRight, fmt);
	}

	// Old default was bottom-center {{page}}. If nothing landed in any slot,
	// keep a page number in the footer center so existing profiles don't go blank.
	const anySlot = [
		page.headerLeft,
		page.headerCenter,
		page.headerRight,
		page.footerLeft,
		page.footerCenter,
		page.footerRight,
	].some((s) => s?.trim());
	if (!anySlot && pn !== "none") {
		page.footerCenter = fmt;
	}

	stripLegacyPageKeys(page as unknown as Record<string, unknown>);
}

function joinSlot(existing: string, extra: string): string {
	const a = (existing ?? "").trim();
	const b = extra.trim();
	if (!a) return b;
	if (!b || a.includes(b)) return a;
	return `${a}  ${b}`;
}

function stripLegacyPageKeys(page: Record<string, unknown>): void {
	delete page.pageNumber;
	delete page.pageNumberFormat;
	delete page.headerText;
	delete page.headerAlign;
	delete page.footerText;
	delete page.footerAlign;
}
