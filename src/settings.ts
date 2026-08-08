import { App, PluginSettingTab, Setting, TextComponent } from "obsidian";
import type BeautifulPdfPlugin from "./main";
import {
	cloneProfile,
	createBlankProfile,
	getActiveProfile,
} from "./profiles";
import {
	ELEMENT_GROUPS,
	ELEMENT_LABELS,
	ELEMENT_PREVIEW_TEXT,
	ELEMENTS_WITH_BACKGROUND,
	ELEMENTS_WITH_FRAME,
	FRAME_PRESET_OPTIONS,
	type ElementKey,
	type ElementStyle,
	type FontWeight,
	type FramePreset,
	type HfAlign,
	type PageNumberPos,
	type PageSize,
	type TextAlign,
} from "./types";
import { applyFramePreview } from "./frame";
import { lineHeightCss, toLineHeightPercent } from "./util";

type UiState = {
	pageOpen: boolean;
	marginsOpen: boolean;
	pageNumberOpen: boolean;
	headerFooterOpen: boolean;
	morePageOpen: boolean;
	groupOpen: Record<string, boolean>;
	elementOpen: Partial<Record<ElementKey, boolean>>;
};

export class BeautifulPdfSettingTab extends PluginSettingTab {
	plugin: BeautifulPdfPlugin;
	private ui: UiState = {
		pageOpen: false,
		marginsOpen: false,
		pageNumberOpen: false,
		headerFooterOpen: false,
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
		containerEl.empty();
		containerEl.addClass("beautiful-pdf-settings");

		containerEl.createEl("h2", { text: "Beautiful PDF" });

		this.renderProfiles(containerEl);
		this.renderPageSection(containerEl);
		this.renderElementsSection(containerEl);

		const tip = containerEl.createDiv({ cls: "beautiful-pdf-tip" });
		tip.createEl("strong", { text: "페이지 나누기: " });
		tip.appendText("노트에 ");
		tip.createEl("code", { text: "%%pdf-pagebreak%%" });
		tip.appendText(" 또는 명령어 ");
		tip.createEl("code", { text: "Insert page break" });
		tip.appendText(".");
	}

	/* ---------- Profiles ---------- */

	private renderProfiles(containerEl: HTMLElement): void {
		const section = containerEl.createDiv({ cls: "beautiful-pdf-section" });
		section.createEl("h3", { text: "문서 프로필" });

		const chips = section.createDiv({ cls: "beautiful-pdf-profile-chips" });
		for (const p of this.plugin.settings.profiles) {
			const chip = chips.createEl("button", {
				cls:
					"beautiful-pdf-profile-chip" +
					(p.id === this.plugin.settings.activeProfileId ? " is-active" : ""),
				text: p.name,
				attr: { type: "button" },
			});
			chip.onclick = async () => {
				this.plugin.settings.activeProfileId = p.id;
				await this.plugin.saveSettings();
				this.display();
			};
		}

		const actions = section.createDiv({ cls: "beautiful-pdf-profile-actions" });
		const mkAction = (label: string, cls: string, fn: () => void) => {
			const b = actions.createEl("button", {
				text: label,
				cls: `beautiful-pdf-action-btn ${cls}`,
				attr: { type: "button" },
			});
			b.onclick = fn;
		};

		mkAction("새 프로필", "", async () => {
			const profile = createBlankProfile(
				`프로필 ${this.plugin.settings.profiles.length + 1}`,
			);
			this.plugin.settings.profiles.push(profile);
			this.plugin.settings.activeProfileId = profile.id;
			await this.plugin.saveSettings();
			this.display();
		});
		mkAction("복제", "", async () => {
			const active = getActiveProfile(this.plugin.settings);
			const copy = cloneProfile(active, `${active.name} 복사`);
			this.plugin.settings.profiles.push(copy);
			this.plugin.settings.activeProfileId = copy.id;
			await this.plugin.saveSettings();
			this.display();
		});
		mkAction("삭제", "is-danger", async () => {
			if (this.plugin.settings.profiles.length <= 1) return;
			const id = this.plugin.settings.activeProfileId;
			this.plugin.settings.profiles = this.plugin.settings.profiles.filter(
				(p) => p.id !== id,
			);
			this.plugin.settings.activeProfileId = this.plugin.settings.profiles[0].id;
			await this.plugin.saveSettings();
			this.display();
		});

		section.createEl("hr", { cls: "beautiful-pdf-divider" });

		const profile = getActiveProfile(this.plugin.settings);
		new Setting(section)
			.setName("프로필 이름")
			.addText((text) =>
				text.setValue(profile.name).onChange(async (v) => {
					profile.name = v.trim() || profile.name;
					await this.plugin.saveSettings();
					const active = chips.querySelector(".is-active");
					if (active) active.setText(profile.name);
				}),
			);
	}

	/* ---------- Page ---------- */

	private renderPageSection(containerEl: HTMLElement): void {
		const page = getActiveProfile(this.plugin.settings).page;
		page.lineHeight = toLineHeightPercent(page.lineHeight);
		const summary = `${page.pageSize} · 여백 ${page.marginTopMm}/${page.marginBottomMm}/${page.marginLeftMm}/${page.marginRightMm}mm`;

		this.collapsible(
			containerEl,
			"페이지",
			summary,
			this.ui.pageOpen,
			(open) => {
				this.ui.pageOpen = open;
			},
			(body) => {
				const titleToggle = this.rowBox(body);
				new Setting(titleToggle)
					.setName("파일명을 제목으로 쓰기")
					.addToggle((tg) =>
						tg.setValue(page.useFilenameAsTitle).onChange(async (v) => {
							page.useFilenameAsTitle = v;
							await this.plugin.saveSettings();
						}),
					);

				const sizeBox = this.rowBox(body);
				new Setting(sizeBox)
					.setName("용지 크기")
					.addDropdown((dd) => {
						(["A4", "Letter", "Legal", "Custom"] as PageSize[]).forEach((s) =>
							dd.addOption(s, s),
						);
						dd.setValue(page.pageSize).onChange(async (v) => {
							page.pageSize = v as PageSize;
							await this.plugin.saveSettings();
							this.display();
						});
					});

				if (page.pageSize === "Custom") {
					const customBox = this.rowBox(body);
					this.numSetting(customBox, "너비 (mm)", page.pageWidthMm, async (n) => {
						page.pageWidthMm = n;
					});
					this.numSetting(customBox, "높이 (mm)", page.pageHeightMm, async (n) => {
						page.pageHeightMm = n;
					});
				}

				this.collapsible(
					body,
					"여백",
					`${page.marginTopMm} / ${page.marginBottomMm} / ${page.marginLeftMm} / ${page.marginRightMm} mm`,
					this.ui.marginsOpen,
					(o) => {
						this.ui.marginsOpen = o;
					},
					(inner) => {
						this.numSetting(inner, "위 (mm)", page.marginTopMm, async (n) => {
							page.marginTopMm = n;
						});
						this.numSetting(inner, "아래 (mm)", page.marginBottomMm, async (n) => {
							page.marginBottomMm = n;
						});
						this.numSetting(inner, "왼쪽 (mm)", page.marginLeftMm, async (n) => {
							page.marginLeftMm = n;
						});
						this.numSetting(inner, "오른쪽 (mm)", page.marginRightMm, async (n) => {
							page.marginRightMm = n;
						});
					},
					true,
				);

				const pnLabel =
					(
						{
							none: "없음",
							"bottom-center": "하단 가운데",
							"bottom-right": "하단 오른쪽",
							"top-center": "상단 가운데",
						} as Record<PageNumberPos, string>
					)[page.pageNumber] ?? page.pageNumber;

				this.collapsible(
					body,
					"페이지 번호",
					pnLabel,
					this.ui.pageNumberOpen,
					(o) => {
						this.ui.pageNumberOpen = o;
					},
					(inner) => {
						new Setting(inner)
							.setName("위치")
							.addDropdown((dd) => {
								const opts: Record<PageNumberPos, string> = {
									none: "없음",
									"bottom-center": "하단 가운데",
									"bottom-right": "하단 오른쪽",
									"top-center": "상단 가운데",
								};
								for (const [k, label] of Object.entries(opts))
									dd.addOption(k, label);
								dd.setValue(page.pageNumber).onChange(async (v) => {
									page.pageNumber = v as PageNumberPos;
									await this.plugin.saveSettings();
									this.display();
								});
							});
						new Setting(inner)
							.setName("형식")
							.addText((t) =>
								t
									.setPlaceholder("{page} / {pages}")
									.setValue(page.pageNumberFormat)
									.onChange(async (v) => {
										page.pageNumberFormat = v;
										await this.plugin.saveSettings();
									}),
							);
					},
					true,
				);

				const hfSummary =
					[
						page.headerText ? `머리글(${page.headerAlign})` : null,
						page.footerText ? `바닥글(${page.footerAlign})` : null,
					]
						.filter(Boolean)
						.join(" · ") || "없음";

				this.collapsible(
					body,
					"머리글 · 바닥글",
					hfSummary,
					this.ui.headerFooterOpen,
					(o) => {
						this.ui.headerFooterOpen = o;
					},
					(inner) => {
						new Setting(inner)
							.setName("머리글 텍스트")
							.addText((t) =>
								t.setValue(page.headerText).onChange(async (v) => {
									page.headerText = v;
									await this.plugin.saveSettings();
								}),
							);
						new Setting(inner)
							.setName("머리글 정렬")
							.addDropdown((dd) => {
								this.addHfAlignOptions(dd);
								dd.setValue(page.headerAlign ?? "left").onChange(async (v) => {
									page.headerAlign = v as HfAlign;
									await this.plugin.saveSettings();
								});
							});
						new Setting(inner)
							.setName("바닥글 텍스트")
							.addText((t) =>
								t.setValue(page.footerText).onChange(async (v) => {
									page.footerText = v;
									await this.plugin.saveSettings();
								}),
							);
						new Setting(inner)
							.setName("바닥글 정렬")
							.addDropdown((dd) => {
								this.addHfAlignOptions(dd);
								dd.setValue(page.footerAlign ?? "center").onChange(async (v) => {
									page.footerAlign = v as HfAlign;
									await this.plugin.saveSettings();
								});
							});
					},
					true,
				);

				this.collapsible(
					body,
					"기타",
					`행간 ${page.lineHeight}% · 배경 ${page.printBackground ? "켜짐" : "꺼짐"}`,
					this.ui.morePageOpen,
					(o) => {
						this.ui.morePageOpen = o;
					},
					(inner) => {
						new Setting(inner)
							.setName("기본 행간 (%)")
							.addText((t) =>
								t.setValue(String(page.lineHeight)).onChange(async (v) => {
									const n = parseFloat(v);
									if (!Number.isNaN(n) && n > 0) {
										page.lineHeight = toLineHeightPercent(n);
										await this.plugin.saveSettings();
									}
								}),
							);
						new Setting(inner)
							.setName("배경 인쇄")
							.addToggle((tg) =>
								tg.setValue(page.printBackground).onChange(async (v) => {
									page.printBackground = v;
									await this.plugin.saveSettings();
								}),
							);
					},
					true,
				);
			},
		);
	}

	private addHfAlignOptions(dd: {
		addOption: (v: string, d: string) => unknown;
	}): void {
		dd.addOption("left", "왼쪽");
		dd.addOption("center", "가운데");
		dd.addOption("right", "오른쪽");
	}

	/* ---------- Markdown elements ---------- */

	private renderElementsSection(containerEl: HTMLElement): void {
		const section = containerEl.createDiv({ cls: "beautiful-pdf-section" });
		section.createEl("h3", { text: "마크다운 요소" });

		const elements = getActiveProfile(this.plugin.settings).elements;

		for (const group of ELEMENT_GROUPS) {
			const open = this.ui.groupOpen[group.id] ?? false;
			this.collapsible(
				section,
				group.label,
				`${group.keys.length}개 요소`,
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
				.setName("박스 스타일")
				.addDropdown((dd) => {
					for (const opt of FRAME_PRESET_OPTIONS) {
						dd.addOption(opt.id, opt.label);
					}
					dd.setValue(style.framePreset ?? "accent-bar").onChange(async (v) => {
						style.framePreset = v as FramePreset;
						await this.plugin.saveSettings();
						refreshPreview();
					});
				});
		}

		new Setting(editors)
			.setName("폰트")
			.addText((t) =>
				t.setValue(style.fontFamily).onChange(async (v) => {
					style.fontFamily = v;
					await this.plugin.saveSettings();
					refreshPreview();
				}),
			);

		new Setting(editors)
			.setName("크기 (pt)")
			.addText((t) =>
				t.setValue(String(style.fontSize)).onChange(async (v) => {
					const n = parseFloat(v);
					if (!Number.isNaN(n)) {
						style.fontSize = n;
						await this.plugin.saveSettings();
						refreshPreview();
					}
				}),
			);

		new Setting(editors)
			.setName("굵기")
			.addDropdown((dd) => {
				(["normal", "bold", "300", "500", "600", "700"] as FontWeight[]).forEach(
					(w) => dd.addOption(w, w),
				);
				dd.setValue(style.fontWeight).onChange(async (v) => {
					style.fontWeight = v as FontWeight;
					await this.plugin.saveSettings();
					refreshPreview();
				});
			});

		new Setting(editors)
			.setName("정렬")
			.addDropdown((dd) => {
				(["left", "center", "right", "justify"] as TextAlign[]).forEach((a) =>
					dd.addOption(a, a),
				);
				dd.setValue(style.align).onChange(async (v) => {
					style.align = v as TextAlign;
					await this.plugin.saveSettings();
					refreshPreview();
				});
			});

		this.addColorSetting(editors, "글자색", style.color, async (v) => {
			style.color = v;
			await this.plugin.saveSettings();
			refreshPreview();
		});

		if (ELEMENTS_WITH_BACKGROUND.includes(key)) {
			this.addColorSetting(
				editors,
				"배경색",
				style.backgroundColor ?? "#ffffff",
				async (v) => {
					style.backgroundColor = v;
					await this.plugin.saveSettings();
					refreshPreview();
				},
			);
		}

		new Setting(editors)
			.setName("위 여백 (pt)")
			.addText((t) =>
				t.setValue(String(style.marginTop)).onChange(async (v) => {
					const n = parseFloat(v);
					if (!Number.isNaN(n)) {
						style.marginTop = n;
						await this.plugin.saveSettings();
						refreshPreview();
					}
				}),
			);

		new Setting(editors)
			.setName("아래 여백 (pt)")
			.addText((t) =>
				t.setValue(String(style.marginBottom)).onChange(async (v) => {
					const n = parseFloat(v);
					if (!Number.isNaN(n)) {
						style.marginBottom = n;
						await this.plugin.saveSettings();
						refreshPreview();
					}
				}),
			);

		if (style.lineHeight != null) {
			new Setting(editors)
				.setName("행간 (%)")
				.addText((t) =>
					t.setValue(String(style.lineHeight)).onChange(async (v) => {
						const n = parseFloat(v);
						if (!Number.isNaN(n) && n > 0) {
							style.lineHeight = toLineHeightPercent(n);
							await this.plugin.saveSettings();
							refreshPreview();
						}
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
			t.setValue(value).onChange(async (v) => {
				await onChange(v);
				const hex = normalizeHex(v);
				if (hex && colorInput) colorInput.value = hex;
				refreshSwatch();
			});
		});

		const colorInput = setting.controlEl.createEl("input", {
			cls: "beautiful-pdf-color-picker",
			attr: { type: "color", value: initial, title: "색 선택" },
		});
		colorInput.addEventListener("input", async () => {
			const v = colorInput.value;
			textComp?.setValue(v);
			await onChange(v);
			refreshSwatch();
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
		sample.style.fontFamily = style.fontFamily;
		sample.style.fontSize = `${Math.min(style.fontSize, 22)}pt`;
		sample.style.fontWeight = style.fontWeight;
		sample.style.textAlign = style.align;
		sample.style.color = style.color;
		if (style.lineHeight != null) {
			sample.style.lineHeight = lineHeightCss(style.lineHeight);
		}
		if (style.backgroundColor && ELEMENTS_WITH_BACKGROUND.includes(key)) {
			sample.style.background = style.backgroundColor;
			sample.style.padding = "4px 8px";
			sample.style.borderRadius = "4px";
		}
		if (key === "blockquote") {
			applyFramePreview(sample, "blockquote", style);
		}
		if (key === "codeInline" || key === "codeBlock") {
			if (!style.backgroundColor) sample.style.background = "rgba(0,0,0,0.06)";
			sample.style.padding = "4px 8px";
			sample.style.borderRadius = "4px";
			sample.style.whiteSpace = "pre-wrap";
			sample.style.fontFamily = style.fontFamily;
		}
		if (key === "hr") {
			sample.style.letterSpacing = "-2px";
			sample.style.color = style.color;
		}
		if (key === "link") {
			sample.style.textDecoration = "underline";
		}
		if (key === "callout") {
			applyFramePreview(sample, "callout", style);
		}
		if (key === "embed") {
			applyFramePreview(sample, "embed", style);
		}
		if (key === "table" || key === "tableHeader") {
			sample.style.border = "1px solid #bbb";
			sample.style.padding = "4px 8px";
			if (key === "tableHeader") {
				sample.style.background = style.backgroundColor ?? "#f0f0f0";
			}
		}
	}

	private collapsible(
		parent: HTMLElement,
		title: string,
		summary: string,
		open: boolean,
		setOpen: (open: boolean) => void,
		renderBody: (body: HTMLElement) => void,
		nested = false,
	): void {
		const box = parent.createDiv({
			cls:
				"beautiful-pdf-fold" +
				(nested ? " is-nested" : "") +
				(open ? " is-open" : ""),
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

	/** Same outer card chrome as nested folds, for single setting rows. */
	private rowBox(parent: HTMLElement): HTMLElement {
		return parent.createDiv({ cls: "beautiful-pdf-row-box" });
	}

	private numSetting(
		containerEl: HTMLElement,
		name: string,
		value: number,
		onChange: (n: number) => Promise<void>,
	): void {
		new Setting(containerEl).setName(name).addText((t) =>
			t.setValue(String(value)).onChange(async (v) => {
				const n = parseFloat(v);
				if (!Number.isNaN(n)) {
					await onChange(n);
					await this.plugin.saveSettings();
				}
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
