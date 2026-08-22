import { App, PluginSettingTab, Setting, TextComponent } from "obsidian";
import type BeautifulPdfPlugin from "./main";
import { listSystemFontFamilies, openFontPicker } from "./fonts";
import {
	cloneProfile,
	createBlankProfile,
	getActiveProfile,
} from "./profiles";
import {
	ELEMENT_GROUPS,
	ELEMENT_KEYS,
	ELEMENT_LABELS,
	ELEMENT_PREVIEW_TEXT,
	ELEMENTS_WITH_BACKGROUND,
	ELEMENTS_WITH_FRAME,
	FRAME_PRESET_OPTIONS,
	HR_PRESET_OPTIONS,
	type ElementKey,
	type ElementStyle,
	type FontWeight,
	type FramePreset,
	type HrPreset,
	type PageSize,
	type TextAlign,
} from "./types";
import { applyFramePreview } from "./frame";
import { applyHrPreview } from "./hr";
import { lineHeightCss, toLineHeightPercent } from "./util";

type SettingsTabId = "page" | "markdown" | "addons";

type UiState = {
	settingsTab: SettingsTabId;
	specialOpen: boolean;
	pageBreakOpen: boolean;
	tableAdjustOpen: boolean;
	imageAdjustOpen: boolean;
	pageSizeOpen: boolean;
	marginsOpen: boolean;
	headerOpen: boolean;
	footerOpen: boolean;
	placeholdersOpen: boolean;
	morePageOpen: boolean;
	groupOpen: Record<string, boolean>;
	elementOpen: Partial<Record<ElementKey, boolean>>;
};

export class BeautifulPdfSettingTab extends PluginSettingTab {
	plugin: BeautifulPdfPlugin;
	private ui: UiState = {
		settingsTab: "page",
		specialOpen: false,
		pageBreakOpen: false,
		tableAdjustOpen: false,
		imageAdjustOpen: false,
		pageSizeOpen: false,
		marginsOpen: false,
		headerOpen: false,
		footerOpen: false,
		placeholdersOpen: false,
		morePageOpen: false,
		groupOpen: {},
		elementOpen: {},
	};

	constructor(app: App, plugin: BeautifulPdfPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		const scroll = this.captureScroll();
		containerEl.empty();
		containerEl.addClass("beautiful-pdf-settings");
		this.renderAll(containerEl);
		this.restoreScroll(scroll);
		// Warm the system font cache for the Choose… picker
		void listSystemFontFamilies();
	}

	/** Obsidian settings scroll pane — Windows resets this on full redraw. */
	private captureScroll(): { el: HTMLElement; top: number } | null {
		const pane = this.containerEl.closest(".vertical-tab-content");
		if (pane instanceof HTMLElement) {
			return { el: pane, top: pane.scrollTop };
		}

		let el: HTMLElement | null = this.containerEl;
		while (el) {
			const { overflowY } = getComputedStyle(el);
			if (
				(overflowY === "auto" || overflowY === "scroll") &&
				el.scrollHeight > el.clientHeight + 1
			) {
				return { el, top: el.scrollTop };
			}
			el = el.parentElement;
		}
		return null;
	}

	private restoreScroll(
		scroll: { el: HTMLElement; top: number } | null,
	): void {
		if (!scroll) return;
		const apply = () => {
			scroll.el.scrollTop = scroll.top;
		};
		apply();
		window.requestAnimationFrame(() => {
			apply();
			window.requestAnimationFrame(apply);
		});
	}

	private renderAll(containerEl: HTMLElement): void {
		this.renderProfiles(containerEl);
		this.renderProfileDependent(containerEl);
	}

	/* ---------- Profiles ---------- */

	private renderProfiles(containerEl: HTMLElement): void {
		const section = containerEl.createDiv({
			cls: "beautiful-pdf-section beautiful-pdf-profile-picker",
		});
		section.createEl("h2", {
			cls: "beautiful-pdf-profile-title",
			text: "Document Profile",
		});

		const chips = section.createDiv({ cls: "beautiful-pdf-profile-chips" });
		for (const p of this.plugin.settings.profiles) {
			const chip = chips.createEl("button", {
				cls:
					"beautiful-pdf-profile-chip" +
					(p.id === this.plugin.settings.activeProfileId ? " is-active" : ""),
				text: p.name,
				attr: { type: "button" },
			});
			chip.onclick = () => {
				void (async () => {
					this.plugin.settings.activeProfileId = p.id;
					await this.plugin.saveSettings();
					this.display();
				})();
			};
		}

		const actions = section.createDiv({ cls: "beautiful-pdf-profile-actions" });
		const mkAction = (label: string, cls: string, fn: () => void | Promise<void>) => {
			const b = actions.createEl("button", {
				text: label,
				cls: `beautiful-pdf-action-btn ${cls}`,
				attr: { type: "button" },
			});
			b.onclick = () => {
				void fn();
			};
		};

		mkAction("New profile", "", async () => {
			const profile = createBlankProfile(
				`Profile ${this.plugin.settings.profiles.length + 1}`,
			);
			this.plugin.settings.profiles.push(profile);
			this.plugin.settings.activeProfileId = profile.id;
			await this.plugin.saveSettings();
			this.display();
		});
		mkAction("Duplicate", "", async () => {
			const active = getActiveProfile(this.plugin.settings);
			const copy = cloneProfile(active, `${active.name} copy`);
			this.plugin.settings.profiles.push(copy);
			this.plugin.settings.activeProfileId = copy.id;
			await this.plugin.saveSettings();
			this.display();
		});
		mkAction("Delete", "is-danger", async () => {
			if (this.plugin.settings.profiles.length <= 1) return;
			const id = this.plugin.settings.activeProfileId;
			this.plugin.settings.profiles = this.plugin.settings.profiles.filter(
				(p) => p.id !== id,
			);
			this.plugin.settings.activeProfileId = this.plugin.settings.profiles[0].id;
			await this.plugin.saveSettings();
			this.display();
		});
	}

	/** Page / Markdown / Add-ons belong to the selected profile. */
	private renderProfileDependent(containerEl: HTMLElement): void {
		const profile = getActiveProfile(this.plugin.settings);
		const wrap = containerEl.createDiv({ cls: "beautiful-pdf-profile-dependent" });
		wrap.createDiv({
			cls: "beautiful-pdf-profile-dependent-label",
			text: `Settings for “${profile.name}”`,
		});

		new Setting(wrap)
			.setName("Profile name")
			.addText((text) =>
				text.setValue(profile.name).onChange((v) => {
					void (async () => {
						profile.name = v.trim() || profile.name;
						await this.plugin.saveSettings();
						const active = containerEl.querySelector(
							".beautiful-pdf-profile-chip.is-active",
						);
						if (active) active.setText(profile.name);
						const label = wrap.querySelector(
							".beautiful-pdf-profile-dependent-label",
						);
						if (label) label.setText(`Settings for “${profile.name}”`);
					})();
				}),
			);

		this.renderSettingsTabs(wrap);
	}

	/* ---------- Tabs ---------- */

	private renderSettingsTabs(containerEl: HTMLElement): void {
		const tabs = containerEl.createDiv({ cls: "beautiful-pdf-tabs" });
		const items: { id: SettingsTabId; label: string }[] = [
			{ id: "page", label: "Page" },
			{ id: "markdown", label: "Markdown" },
			{ id: "addons", label: "Add-ons" },
		];
		for (const item of items) {
			const btn = tabs.createEl("button", {
				cls:
					"beautiful-pdf-tab" +
					(this.ui.settingsTab === item.id ? " is-active" : ""),
				text: item.label,
				attr: { type: "button" },
			});
			btn.onclick = () => {
				if (this.ui.settingsTab === item.id) return;
				this.ui.settingsTab = item.id;
				this.display();
			};
		}

		const panel = containerEl.createDiv({ cls: "beautiful-pdf-tab-panel" });
		if (this.ui.settingsTab === "page") this.renderPageSection(panel);
		else if (this.ui.settingsTab === "markdown") this.renderElementsSection(panel);
		else this.renderSpecialSection(panel);
	}

	/* ---------- Page ---------- */

	private renderPageSection(containerEl: HTMLElement): void {
		const page = getActiveProfile(this.plugin.settings).page;
		page.lineHeight = toLineHeightPercent(page.lineHeight);

		const section = containerEl.createDiv({ cls: "beautiful-pdf-section" });

		const sizeSummary =
			page.pageSize === "Custom"
				? `Custom ${page.pageWidthMm}×${page.pageHeightMm} mm`
				: page.pageSize;

		this.collapsible(
			section,
			"Page size",
			sizeSummary,
			this.ui.pageSizeOpen,
			(open) => {
				this.ui.pageSizeOpen = open;
			},
			(body) => {
				new Setting(body)
					.setName("Size")
					.addDropdown((dd) => {
						(["A4", "Letter", "Legal", "Custom"] as PageSize[]).forEach((s) => {
							dd.addOption(s, s);
						});
						dd.setValue(page.pageSize).onChange((v) => {
							void (async () => {
								page.pageSize = v as PageSize;
								await this.plugin.saveSettings();
								this.display();
							})();
						});
					});

				if (page.pageSize === "Custom") {
					this.numSetting(body, "Width (mm)", page.pageWidthMm, async (n) => {
						page.pageWidthMm = n;
					});
					this.numSetting(body, "Height (mm)", page.pageHeightMm, async (n) => {
						page.pageHeightMm = n;
					});
				}
			},
		);

		this.collapsible(
			section,
			"Margins",
			`${page.marginTopMm} / ${page.marginBottomMm} / ${page.marginLeftMm} / ${page.marginRightMm} mm`,
			this.ui.marginsOpen,
			(o) => {
				this.ui.marginsOpen = o;
			},
			(inner) => {
				this.numSetting(inner, "Top (mm)", page.marginTopMm, async (n) => {
					page.marginTopMm = n;
				});
				this.numSetting(inner, "Bottom (mm)", page.marginBottomMm, async (n) => {
					page.marginBottomMm = n;
				});
				this.numSetting(inner, "Left (mm)", page.marginLeftMm, async (n) => {
					page.marginLeftMm = n;
				});
				this.numSetting(inner, "Right (mm)", page.marginRightMm, async (n) => {
					page.marginRightMm = n;
				});
			},
		);

		this.collapsible(
			section,
			"Header",
			this.hfSlotSummary(page.headerLeft, page.headerCenter, page.headerRight),
			this.ui.headerOpen,
			(o) => {
				this.ui.headerOpen = o;
			},
			(inner) => {
				this.addHfSlot(inner, "Left", page.headerLeft, page.headerLeftStyle, async (text, style) => {
					page.headerLeft = text;
					page.headerLeftStyle = style;
				});
				this.addHfSlot(inner, "Center", page.headerCenter, page.headerCenterStyle, async (text, style) => {
					page.headerCenter = text;
					page.headerCenterStyle = style;
				});
				this.addHfSlot(inner, "Right", page.headerRight, page.headerRightStyle, async (text, style) => {
					page.headerRight = text;
					page.headerRightStyle = style;
				});
				this.addPlaceholderTip(inner);
			},
		);

		this.collapsible(
			section,
			"Footer",
			this.hfSlotSummary(page.footerLeft, page.footerCenter, page.footerRight),
			this.ui.footerOpen,
			(o) => {
				this.ui.footerOpen = o;
			},
			(inner) => {
				this.addHfSlot(inner, "Left", page.footerLeft, page.footerLeftStyle, async (text, style) => {
					page.footerLeft = text;
					page.footerLeftStyle = style;
				});
				this.addHfSlot(inner, "Center", page.footerCenter, page.footerCenterStyle, async (text, style) => {
					page.footerCenter = text;
					page.footerCenterStyle = style;
				});
				this.addHfSlot(inner, "Right", page.footerRight, page.footerRightStyle, async (text, style) => {
					page.footerRight = text;
					page.footerRightStyle = style;
				});
				this.addPlaceholderTip(inner);
			},
		);

		const lhBox = section.createDiv({ cls: "beautiful-pdf-row-box" });
		new Setting(lhBox)
			.setName("Default line height (%)")
			.addText((t) =>
				t.setValue(String(page.lineHeight)).onChange((v) => {
					void (async () => {
						const n = parseFloat(v);
						if (!Number.isNaN(n) && n > 0) {
							page.lineHeight = toLineHeightPercent(n);
							await this.plugin.saveSettings();
						}
					})();
				}),
			);

		this.collapsible(
			section,
			"More",
			`Filename title ${page.useFilenameAsTitle ? "on" : "off"} · background ${page.printBackground ? "on" : "off"}`,
			this.ui.morePageOpen,
			(o) => {
				this.ui.morePageOpen = o;
			},
			(inner) => {
				new Setting(inner)
					.setName("Use filename as title")
					.addToggle((tg) =>
						tg.setValue(page.useFilenameAsTitle).onChange((v) => {
							void (async () => {
								page.useFilenameAsTitle = v;
								await this.plugin.saveSettings();
							})();
						}),
					);
				new Setting(inner)
					.setName("Print background")
					.addToggle((tg) =>
						tg.setValue(page.printBackground).onChange((v) => {
							void (async () => {
								page.printBackground = v;
								await this.plugin.saveSettings();
							})();
						}),
					);
			},
		);
	}

	private hfSlotSummary(left: string, center: string, right: string): string {
		const cells = [left, center, right].map((s) => (s ?? "").trim());
		if (!cells.some(Boolean)) return "None";
		return cells
			.map((s) => {
				if (!s) return "—";
				return s.length > 16 ? `${s.slice(0, 16)}…` : s;
			})
			.join(" · ");
	}

	private addHfSlot(
		parent: HTMLElement,
		name: string,
		value: string,
		styleKey: string,
		onChange: (text: string, style: string) => Promise<void>,
	): void {
		let text = value ?? "";
		let style = styleKey ?? "";
		const setting = new Setting(parent).setName(name);
		setting.addText((t) =>
			t
				.setPlaceholder("None")
				.setValue(text)
				.onChange((v) => {
					text = v;
					void (async () => {
						await onChange(text, style);
						await this.plugin.saveSettings();
					})();
				}),
		);
		setting.addDropdown((dd) => {
			dd.addOption("", "Default");
			for (const key of ELEMENT_KEYS) {
				dd.addOption(key, ELEMENT_LABELS[key]);
			}
			dd.setValue(style).onChange((v) => {
				style = v;
				void (async () => {
					await onChange(text, style);
					await this.plugin.saveSettings();
				})();
			});
		});
	}

	private addPlaceholderTip(parent: HTMLElement): void {
		const tip = parent.createDiv({ cls: "beautiful-pdf-tip" });
		tip.appendText("Use ordinary text and/or placeholders. ");
		tip.createEl("code", { text: "{{page}}" });
		tip.appendText(" current page · ");
		tip.createEl("code", { text: "{{pages}}" });
		tip.appendText(" total pages · ");
		tip.createEl("code", { text: "{{date}}" });
		tip.appendText(" today · ");
		tip.createEl("code", { text: "{{title}}" });
		tip.appendText(" · ");
		tip.createEl("code", { text: "{{filename}}" });
		tip.appendText(" · ");
		tip.createEl("code", { text: "{{folder}}" });
		tip.appendText(" · ");
		tip.createEl("code", { text: "{{vault}}" });
		tip.appendText(" · ");
		tip.createEl("code", { text: "{{ctime}}" });
		tip.appendText(" created · ");
		tip.createEl("code", { text: "{{mtime}}" });
		tip.appendText(" last edited. A note property becomes ");
		tip.createEl("code", { text: "{{name}}" });
		tip.appendText(" (for example ");
		tip.createEl("code", { text: "{{author}}" });
		tip.appendText(" from Properties). Missing values stay blank. Example: ");
		tip.createEl("code", { text: "{{title}}  {{page}}/{{pages}}" });
		tip.appendText(".");
	}

	/* ---------- Extras (PDF-only) ---------- */

	private renderSpecialSection(containerEl: HTMLElement): void {
		const profile = getActiveProfile(this.plugin.settings);
		const special = profile.special;
		const summary = special.styleOrderedListsAsHeadings
			? `Ordered lists → H${special.orderedListHeadingLevel1}/H${special.orderedListHeadingLevel2}/H${special.orderedListHeadingLevel3}`
			: "Off";

		const section = containerEl.createDiv({ cls: "beautiful-pdf-section" });

		this.collapsible(
			section,
			"Numbered lists as headings",
			summary,
			this.ui.specialOpen,
			(open) => {
				this.ui.specialOpen = open;
			},
			(body) => {
				const tip = body.createDiv({ cls: "beautiful-pdf-tip" });
				tip.appendText(
					"PDF-only. Write normal numbered lists (1. 2. 3.) in the note — Obsidian keeps auto-numbering. In the PDF those items use a heading style; # headings and body text stay as usual.",
				);

				new Setting(body)
					.setName("Enable")
					.setDesc("Apply heading look to ordered-list items in the PDF only")
					.addToggle((tg) =>
						tg.setValue(special.styleOrderedListsAsHeadings).onChange((v) => {
							void (async () => {
								special.styleOrderedListsAsHeadings = v;
								await this.plugin.saveSettings();
								this.display();
							})();
						}),
					);

				if (!special.styleOrderedListsAsHeadings) return;

				const addLevel = (
					name: string,
					key:
						| "orderedListHeadingLevel1"
						| "orderedListHeadingLevel2"
						| "orderedListHeadingLevel3",
				) => {
					new Setting(body).setName(name).addDropdown((dd) => {
						for (let i = 1; i <= 6; i++) dd.addOption(String(i), `H${i} style`);
						dd.setValue(String(special[key])).onChange((v) => {
							void (async () => {
								special[key] = Number(v);
								await this.plugin.saveSettings();
								this.display();
							})();
						});
					});
				};
				addLevel("Top level", "orderedListHeadingLevel1");
				addLevel("Nested level", "orderedListHeadingLevel2");
				addLevel("Deeper nested level", "orderedListHeadingLevel3");
			},
		);

		this.collapsible(
			section,
			"Page break",
			special.enablePageBreaks ? "On" : "Off",
			this.ui.pageBreakOpen,
			(open) => {
				this.ui.pageBreakOpen = open;
			},
			(body) => {
				new Setting(body)
					.setName("Enable")
					.setDesc("Turn %%pdf-pagebreak%% markers into PDF page breaks")
					.addToggle((tg) =>
						tg.setValue(special.enablePageBreaks).onChange((v) => {
							void (async () => {
								special.enablePageBreaks = v;
								await this.plugin.saveSettings();
								this.display();
							})();
						}),
					);

				if (!special.enablePageBreaks) return;

				const tip = body.createDiv({ cls: "beautiful-pdf-tip" });
				tip.appendText("Insert ");
				tip.createEl("code", { text: "%%pdf-pagebreak%%" });
				tip.appendText(" in a note, or use the command ");
				tip.createEl("code", { text: "Insert page break" });
				tip.appendText(".");
			},
		);

		this.collapsible(
			section,
			"Adjust tables",
			special.enableTableAdjust ? "On" : "Off",
			this.ui.tableAdjustOpen,
			(open) => {
				this.ui.tableAdjustOpen = open;
			},
			(body) => {
				new Setting(body)
					.setName("Enable")
					.setDesc("Optional step to resize table columns and rows before PDF")
					.addToggle((tg) =>
						tg.setValue(special.enableTableAdjust).onChange((v) => {
							void (async () => {
								special.enableTableAdjust = v;
								await this.plugin.saveSettings();
								this.display();
							})();
						}),
					);

				if (!special.enableTableAdjust) return;

				const tip = body.createDiv({ cls: "beautiful-pdf-tip" });
				tip.appendText(
					"PDF-only. Use Adjust tables… in preview, the command palette, or the file menu to drag column and row sizes. Saved layouts apply on preview and export.",
				);
			},
		);

		this.collapsible(
			section,
			"Adjust images",
			special.enableImageAdjust ? "On" : "Off",
			this.ui.imageAdjustOpen,
			(open) => {
				this.ui.imageAdjustOpen = open;
			},
			(body) => {
				new Setting(body)
					.setName("Enable")
					.setDesc("Optional step to set image size and alignment before PDF")
					.addToggle((tg) =>
						tg.setValue(special.enableImageAdjust).onChange((v) => {
							void (async () => {
								special.enableImageAdjust = v;
								await this.plugin.saveSettings();
								this.display();
							})();
						}),
					);

				if (!special.enableImageAdjust) return;

				const tip = body.createDiv({ cls: "beautiful-pdf-tip" });
				tip.appendText(
					"PDF-only. Use Adjust images… to pick size (S/M/L/Full) and block alignment (left/center/right). Text wrap around images is not supported in print. Saved layouts apply on preview and export.",
				);
			},
		);

		this.collapsible(
			section,
			"Header & footer placeholders",
			special.enablePlaceholders ? "On" : "Off",
			this.ui.placeholdersOpen,
			(open) => {
				this.ui.placeholdersOpen = open;
			},
			(body) => {
				new Setting(body)
					.setName("Enable")
					.setDesc("Replace {{page}}, {{title}}, and other placeholders in header/footer")
					.addToggle((tg) =>
						tg.setValue(special.enablePlaceholders).onChange((v) => {
							void (async () => {
								special.enablePlaceholders = v;
								await this.plugin.saveSettings();
								this.display();
							})();
						}),
					);

				if (!special.enablePlaceholders) return;

				const tip = body.createDiv({ cls: "beautiful-pdf-tip" });
				tip.appendText(
					"When on, placeholders in Page → Header / Footer become real values in the PDF (page numbers, note title, Properties fields, file dates, and so on). When off, the {{braces}} print as written.",
				);
			},
		);
	}

	/* ---------- Markdown elements ---------- */

	private renderElementsSection(containerEl: HTMLElement): void {
		const section = containerEl.createDiv({ cls: "beautiful-pdf-section" });
		const elements = getActiveProfile(this.plugin.settings).elements;

		for (const group of ELEMENT_GROUPS) {
			const open = this.ui.groupOpen[group.id] ?? false;
			this.collapsible(
				section,
				group.label,
				`${group.keys.length} elements`,
				open,
				(o) => {
					this.ui.groupOpen[group.id] = o;
				},
				(body) => {
					for (const key of group.keys) {
						this.renderElementRow(body, key, elements[key]);
					}
				},
			);
		}
	}

	private renderElementRow(
		parent: HTMLElement,
		key: ElementKey,
		style: ElementStyle,
	): void {
		if (style.lineHeight != null) {
			style.lineHeight = toLineHeightPercent(style.lineHeight);
		}
		const expanded = !!this.ui.elementOpen[key];
		const row = parent.createDiv({
			cls: "beautiful-pdf-el-row" + (expanded ? " is-open" : ""),
		});

		const head = row.createDiv({ cls: "beautiful-pdf-el-head" });
		head.createDiv({ cls: "beautiful-pdf-el-label", text: ELEMENT_LABELS[key] });

		const preview = head.createDiv({ cls: "beautiful-pdf-el-preview" });
		this.paintPreview(preview, key, style);

		head.createSpan({
			cls: "beautiful-pdf-el-chevron",
			text: expanded ? "▾" : "▸",
		});

		head.onclick = () => {
			this.ui.elementOpen[key] = !expanded;
			this.display();
		};

		if (!expanded) return;

		const editors = row.createDiv({ cls: "beautiful-pdf-el-editors" });
		const refreshPreview = () => this.paintPreview(preview, key, style);

		if (ELEMENTS_WITH_FRAME.includes(key)) {
			new Setting(editors)
				.setName("Box style")
				.addDropdown((dd) => {
					for (const opt of FRAME_PRESET_OPTIONS) {
						dd.addOption(opt.id, opt.label);
					}
					dd.setValue(style.framePreset ?? "accent-bar").onChange((v) => {
				void (async () => {
						style.framePreset = v as FramePreset;
						await this.plugin.saveSettings();
						refreshPreview();
					})();
			});
				});
		}

		if (key === "hr") {
			new Setting(editors)
				.setName("Line style")
				.addDropdown((dd) => {
					for (const opt of HR_PRESET_OPTIONS) {
						dd.addOption(opt.id, opt.label);
					}
					dd.setValue(style.hrPreset ?? "solid").onChange((v) => {
						void (async () => {
							style.hrPreset = v as HrPreset;
							await this.plugin.saveSettings();
							refreshPreview();
						})();
					});
				});

			this.addColorSetting(editors, "Line color", style.color, async (v) => {
				style.color = v;
				await this.plugin.saveSettings();
				refreshPreview();
			});

			new Setting(editors)
				.setName("Margin top (pt)")
				.addText((t) =>
					t.setValue(String(style.marginTop)).onChange((v) => {
						void (async () => {
							const n = parseFloat(v);
							if (!Number.isNaN(n)) {
								style.marginTop = n;
								await this.plugin.saveSettings();
								refreshPreview();
							}
						})();
					}),
				);

			new Setting(editors)
				.setName("Margin bottom (pt)")
				.addText((t) =>
					t.setValue(String(style.marginBottom)).onChange((v) => {
						void (async () => {
							const n = parseFloat(v);
							if (!Number.isNaN(n)) {
								style.marginBottom = n;
								await this.plugin.saveSettings();
								refreshPreview();
							}
						})();
					}),
				);
			return;
		}

		const fontSetting = new Setting(editors).setName("Font");
		let fontText: TextComponent | null = null;
		fontSetting.addText((t) => {
			fontText = t;
			t.setPlaceholder("Font family");
			t.setValue(style.fontFamily).onChange((v) => {
				void (async () => {
					style.fontFamily = v;
					await this.plugin.saveSettings();
					refreshPreview();
				})();
			});
		});
		fontSetting.addButton((btn) =>
			btn.setButtonText("Choose…").onClick(() => {
				void openFontPicker(this.app, (font) => {
					style.fontFamily = font;
					fontText?.setValue(font);
					void this.plugin.saveSettings().then(() => refreshPreview());
				});
			}),
		);

		new Setting(editors)
			.setName("Size (pt)")
			.addText((t) =>
				t.setValue(String(style.fontSize)).onChange((v) => {
				void (async () => {
					const n = parseFloat(v);
					if (!Number.isNaN(n)) {
						style.fontSize = n;
						await this.plugin.saveSettings();
						refreshPreview();
					}
				})();
			}),
			);

		new Setting(editors)
			.setName("Weight")
			.addDropdown((dd) => {
				(["normal", "bold", "300", "500", "600", "700"] as FontWeight[]).forEach(
					(w) => {
						dd.addOption(w, w);
					},
				);
				dd.setValue(style.fontWeight).onChange((v) => {
					void (async () => {
						style.fontWeight = v as FontWeight;
						await this.plugin.saveSettings();
						refreshPreview();
					})();
				});
			});

		new Setting(editors)
			.setName("Align")
			.addDropdown((dd) => {
				(["left", "center", "right", "justify"] as TextAlign[]).forEach((a) => {
					dd.addOption(a, a);
				});
				dd.setValue(style.align).onChange((v) => {
					void (async () => {
						style.align = v as TextAlign;
						await this.plugin.saveSettings();
						refreshPreview();
					})();
				});
			});

		this.addColorSetting(editors, "Text color", style.color, async (v) => {
			style.color = v;
			await this.plugin.saveSettings();
			refreshPreview();
		});

		if (ELEMENTS_WITH_BACKGROUND.includes(key)) {
			this.addColorSetting(
				editors,
				"Background",
				style.backgroundColor ?? "#ffffff",
				async (v) => {
					style.backgroundColor = v;
					await this.plugin.saveSettings();
					refreshPreview();
				},
			);
		}

		new Setting(editors)
			.setName("Margin top (pt)")
			.addText((t) =>
				t.setValue(String(style.marginTop)).onChange((v) => {
				void (async () => {
					const n = parseFloat(v);
					if (!Number.isNaN(n)) {
						style.marginTop = n;
						await this.plugin.saveSettings();
						refreshPreview();
					}
				})();
			}),
			);

		new Setting(editors)
			.setName("Margin bottom (pt)")
			.addText((t) =>
				t.setValue(String(style.marginBottom)).onChange((v) => {
				void (async () => {
					const n = parseFloat(v);
					if (!Number.isNaN(n)) {
						style.marginBottom = n;
						await this.plugin.saveSettings();
						refreshPreview();
					}
				})();
			}),
			);

		if (style.lineHeight != null) {
			new Setting(editors)
				.setName("Line height (%)")
				.addText((t) =>
					t.setValue(String(style.lineHeight)).onChange((v) => {
				void (async () => {
						const n = parseFloat(v);
						if (!Number.isNaN(n) && n > 0) {
							style.lineHeight = toLineHeightPercent(n);
							await this.plugin.saveSettings();
							refreshPreview();
						}
					})();
			}),
				);
		}
	}

	private addColorSetting(
		parent: HTMLElement,
		name: string,
		value: string,
		onChange: (v: string) => Promise<void>,
	): void {
		const setting = new Setting(parent).setName(name);
		let textComp: TextComponent | null = null;

		const initial = normalizeHex(value) ?? "#1a1a1a";

		setting.addText((t) => {
			textComp = t;
			t.inputEl.addClass("beautiful-pdf-hex-input");
			t.setPlaceholder("#1a1a1a");
			t.setValue(value).onChange((v) => {
				void (async () => {
				await onChange(v);
				const hex = normalizeHex(v);
				if (hex && colorInput) colorInput.value = hex;
				refreshSwatch();
			})();
			});
		});

		const colorInput = setting.controlEl.createEl("input", {
			cls: "beautiful-pdf-color-picker",
			attr: { type: "color", value: initial, title: "Pick color" },
		});
		colorInput.addEventListener("input", () => {
			void (async () => {
				const v = colorInput.value;
				textComp?.setValue(v);
				await onChange(v);
				refreshSwatch();
			})();
		});

		const refreshSwatch = () => {
			/* text + picker stay in sync; no-op hook for clarity */
		};
	}

	private paintPreview(
		el: HTMLElement,
		key: ElementKey,
		style: ElementStyle,
	): void {
		el.empty();
		el.addClass(`beautiful-pdf-preview-kind-${key}`);
		const sample = el.createDiv({ cls: "beautiful-pdf-preview-sample" });
		sample.setText(ELEMENT_PREVIEW_TEXT[key]);
		const dynamic: Partial<CSSStyleDeclaration> = {
			fontFamily: style.fontFamily,
			fontSize: `${Math.min(style.fontSize, 22)}pt`,
			fontWeight: style.fontWeight,
			textAlign: style.align,
			color: style.color,
		};
		if (style.lineHeight != null) {
			dynamic.lineHeight = lineHeightCss(style.lineHeight);
		}
		if (style.backgroundColor && ELEMENTS_WITH_BACKGROUND.includes(key)) {
			sample.addClass("has-bg");
			dynamic.background = style.backgroundColor;
		}
		if (key === "codeInline" || key === "codeBlock") {
			sample.addClass("is-code");
			dynamic.background = style.backgroundColor ?? "rgba(0,0,0,0.06)";
			dynamic.fontFamily = style.fontFamily;
		}
		if (key === "hr") {
			applyHrPreview(sample, style);
			return;
		}
		if (key === "link") {
			sample.addClass("is-link");
		}
		if (key === "table" || key === "tableHeader") {
			sample.addClass("is-table");
			if (key === "tableHeader") {
				sample.addClass("is-table-header");
				dynamic.background = style.backgroundColor ?? "#f0f0f0";
			}
		}
		sample.setCssStyles(dynamic);
		if (key === "blockquote") {
			applyFramePreview(sample, "blockquote", style);
		}
		if (key === "callout") {
			applyFramePreview(sample, "callout", style);
		}
		if (key === "embed") {
			applyFramePreview(sample, "embed", style);
		}
	}

	private collapsible(
		parent: HTMLElement,
		title: string,
		summary: string,
		open: boolean,
		setOpen: (open: boolean) => void,
		renderBody: (body: HTMLElement) => void,
	): void {
		const box = parent.createDiv({
			cls: "beautiful-pdf-fold" + (open ? " is-open" : ""),
		});
		const head = box.createDiv({ cls: "beautiful-pdf-fold-head" });
		head.createSpan({ cls: "beautiful-pdf-fold-title", text: title });
		if (summary) {
			head.createSpan({ cls: "beautiful-pdf-fold-summary", text: summary });
		}
		head.createSpan({ cls: "beautiful-pdf-fold-chevron", text: open ? "▾" : "▸" });
		head.onclick = () => {
			setOpen(!open);
			this.display();
		};
		if (open) {
			const body = box.createDiv({ cls: "beautiful-pdf-fold-body" });
			renderBody(body);
		}
	}

	private numSetting(
		containerEl: HTMLElement,
		name: string,
		value: number,
		onChange: (n: number) => Promise<void>,
	): void {
		new Setting(containerEl).setName(name).addText((t) =>
			t.setValue(String(value)).onChange((v) => {
				void (async () => {
				const n = parseFloat(v);
				if (!Number.isNaN(n)) {
					await onChange(n);
					await this.plugin.saveSettings();
				}
			})();
			}),
		);
	}
}

function normalizeHex(value: string): string | null {
	const v = value.trim();
	if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
	if (/^#[0-9a-fA-F]{3}$/.test(v)) {
		const r = v[1];
		const g = v[2];
		const b = v[3];
		return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
	}
	return null;
}
