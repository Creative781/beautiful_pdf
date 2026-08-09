import {
	createDefaultSpecialOptions,
	type BeautifulPdfSettings,
	type ElementStyle,
	type ElementStyles,
	type PageSettings,
	type Profile,
} from "./types";

const KOR =
	'"KoPubWorldDotum", "KoPub Dotum", "Apple SD Gothic Neo", "NanumGothic", "Malgun Gothic", sans-serif';
const KOR_SERIF =
	'"KoPubWorldBatang", "Apple Myungjo", "NanumMyeongjo", "Batang", serif';
const MONO = '"Menlo", "Consolas", "D2Coding", monospace';

function el(
	partial: Partial<ElementStyle> & Pick<ElementStyle, "fontSize">,
): ElementStyle {
	return {
		fontFamily: KOR,
		fontWeight: "normal",
		align: "left",
		color: "#1a1a1a",
		marginTop: 0,
		marginBottom: 8,
		...partial,
	};
}

function baseElements(): ElementStyles {
	return {
		h1: el({
			fontSize: 22,
			fontWeight: "bold",
			align: "center",
			marginTop: 0,
			marginBottom: 16,
			lineHeight: 130,
		}),
		h2: el({
			fontSize: 18,
			fontWeight: "bold",
			marginTop: 18,
			marginBottom: 10,
			lineHeight: 135,
		}),
		h3: el({
			fontSize: 15,
			fontWeight: "bold",
			marginTop: 14,
			marginBottom: 8,
			lineHeight: 135,
		}),
		h4: el({
			fontSize: 13,
			fontWeight: "bold",
			marginTop: 12,
			marginBottom: 6,
		}),
		h5: el({
			fontSize: 12,
			fontWeight: "bold",
			marginTop: 10,
			marginBottom: 4,
		}),
		h6: el({
			fontSize: 11,
			fontWeight: "bold",
			marginTop: 8,
			marginBottom: 4,
			color: "#444444",
		}),
		body: el({
			fontSize: 11,
			lineHeight: 170,
			marginBottom: 8,
		}),
		blockquote: el({
			fontSize: 11,
			color: "#444444",
			paddingLeft: 12,
			marginTop: 8,
			marginBottom: 8,
			lineHeight: 160,
			backgroundColor: "#f7f7f7",
			framePreset: "accent-bar",
		}),
		list: el({
			fontSize: 11,
			marginBottom: 6,
			lineHeight: 160,
			paddingLeft: 4,
		}),
		taskList: el({
			fontSize: 11,
			marginBottom: 4,
			lineHeight: 155,
		}),
		codeInline: el({
			fontFamily: MONO,
			fontSize: 10,
			color: "#b00020",
			marginBottom: 0,
			backgroundColor: "#f0f0f0",
		}),
		codeBlock: el({
			fontFamily: MONO,
			fontSize: 9.5,
			marginTop: 8,
			marginBottom: 10,
			lineHeight: 145,
			paddingLeft: 0,
			backgroundColor: "#f4f4f4",
		}),
		hr: el({
			fontSize: 11,
			marginTop: 16,
			marginBottom: 16,
			color: "#cccccc",
		}),
		table: el({
			fontSize: 10,
			marginTop: 8,
			marginBottom: 10,
			lineHeight: 140,
		}),
		tableHeader: el({
			fontSize: 10,
			fontWeight: "bold",
			marginBottom: 0,
			backgroundColor: "#f0f0f0",
		}),
		callout: el({
			fontSize: 11,
			marginTop: 10,
			marginBottom: 10,
			paddingLeft: 8,
			lineHeight: 155,
			backgroundColor: "#f5f8fb",
			framePreset: "accent-bar",
		}),
		calloutTitle: el({
			fontSize: 11,
			fontWeight: "bold",
			marginBottom: 4,
		}),
		image: el({
			fontSize: 11,
			align: "center",
			marginTop: 10,
			marginBottom: 10,
		}),
		link: el({
			fontSize: 11,
			color: "#0b57d0",
			marginBottom: 0,
		}),
		footnote: el({
			fontSize: 9,
			color: "#555555",
			marginTop: 12,
			lineHeight: 140,
		}),
		embed: el({
			fontSize: 10,
			marginTop: 8,
			marginBottom: 8,
			paddingLeft: 8,
			lineHeight: 150,
			color: "#333333",
			backgroundColor: "#fafafa",
			framePreset: "accent-bar",
		}),
	};
}

function basePage(overrides: Partial<PageSettings> = {}): PageSettings {
	return {
		pageSize: "A4",
		pageWidthMm: 210,
		pageHeightMm: 297,
		marginTopMm: 20,
		marginBottomMm: 20,
		marginLeftMm: 18,
		marginRightMm: 18,
		lineHeight: 170,
		pageNumber: "bottom-center",
		pageNumberFormat: "{page}",
		useFilenameAsTitle: true,
		headerText: "",
		headerAlign: "left",
		footerText: "",
		footerAlign: "center",
		printBackground: true,
		...overrides,
	};
}

function cloneElements(src: ElementStyles): ElementStyles {
	const out = {} as ElementStyles;
	for (const key of Object.keys(src) as (keyof ElementStyles)[]) {
		out[key] = { ...src[key] };
	}
	return out;
}

/** Formal report: centered title, tight body, navy accents, classic page numbers. */
export function createReportProfile(): Profile {
	const elements = baseElements();
	elements.h1.fontFamily = KOR;
	elements.h1.fontSize = 22;
	elements.h1.align = "center";
	elements.h1.color = "#111827";
	elements.h1.marginBottom = 20;
	elements.h2.fontSize = 15;
	elements.h2.color = "#1e3a5f";
	elements.h2.marginTop = 22;
	elements.h3.fontSize = 12.5;
	elements.h3.color = "#1e3a5f";
	elements.body.fontSize = 10.5;
	elements.body.lineHeight = 165;
	elements.body.color = "#1f2937";
	elements.blockquote.color = "#374151";
	elements.blockquote.backgroundColor = "#eef2f7";
	elements.blockquote.framePreset = "accent-bar";
	elements.codeInline.color = "#9f1239";
	elements.codeInline.backgroundColor = "#fce7f3";
	elements.codeBlock.backgroundColor = "#f3f4f6";
	elements.tableHeader.backgroundColor = "#1e3a5f";
	elements.tableHeader.color = "#ffffff";
	elements.callout.backgroundColor = "#eef2f7";
	elements.callout.framePreset = "accent-bar";
	elements.link.color = "#1d4ed8";
	elements.embed.backgroundColor = "#f8fafc";
	elements.embed.framePreset = "accent-bar";
	return {
		id: "report",
		name: "Report",
		page: basePage({
			marginTopMm: 28,
			marginBottomMm: 24,
			marginLeftMm: 24,
			marginRightMm: 24,
			lineHeight: 165,
			pageNumber: "bottom-center",
			pageNumberFormat: "- {page} -",
			useFilenameAsTitle: true,
			headerText: "",
			footerText: "",
		}),
		elements,
		special: createDefaultSpecialOptions(),
	};
}

/** Casual notes: large type, airy spacing, warm ink, left-aligned title. */
export function createLifeProfile(): Profile {
	const elements = baseElements();
	elements.h1.align = "left";
	elements.h1.fontSize = 26;
	elements.h1.fontWeight = "700";
	elements.h1.color = "#292524";
	elements.h1.marginBottom = 10;
	elements.h2.fontSize = 17;
	elements.h2.color = "#78716c";
	elements.h2.fontWeight = "600";
	elements.h2.marginTop = 14;
	elements.h3.fontSize = 14;
	elements.h3.color = "#a8a29e";
	elements.body.fontSize = 13;
	elements.body.lineHeight = 200;
	elements.body.color = "#44403c";
	elements.blockquote.color = "#78716c";
	elements.blockquote.backgroundColor = "#faf5f0";
	elements.blockquote.framePreset = "soft-fill";
	elements.list.fontSize = 13;
	elements.list.lineHeight = 190;
	elements.taskList.fontSize = 13;
	elements.codeInline.color = "#b45309";
	elements.codeInline.backgroundColor = "#fff7ed";
	elements.codeBlock.backgroundColor = "#f5f5f4";
	elements.codeBlock.fontSize = 11;
	elements.tableHeader.backgroundColor = "#d6d3d1";
	elements.tableHeader.color = "#1c1917";
	elements.callout.backgroundColor = "#fffbeb";
	elements.callout.framePreset = "soft-fill";
	elements.link.color = "#c2410c";
	elements.hr.color = "#e7e5e4";
	elements.embed.backgroundColor = "#fafaf9";
	elements.embed.framePreset = "soft-fill";
	return {
		id: "life",
		name: "Everyday",
		page: basePage({
			marginTopMm: 14,
			marginBottomMm: 14,
			marginLeftMm: 14,
			marginRightMm: 14,
			lineHeight: 200,
			pageNumber: "bottom-right",
			pageNumberFormat: "{page}",
			useFilenameAsTitle: true,
			headerText: "",
			footerAlign: "right",
		}),
		elements,
		special: createDefaultSpecialOptions(),
	};
}

/** Proposal deck style: serif titles, compact body, strong tables, top page nos. */
export function createPlanProfile(): Profile {
	const elements = baseElements();
	elements.h1.fontFamily = KOR_SERIF;
	elements.h1.fontSize = 24;
	elements.h1.align = "center";
	elements.h1.color = "#0f172a";
	elements.h1.marginBottom = 8;
	elements.h2.fontFamily = KOR_SERIF;
	elements.h2.fontSize = 14;
	elements.h2.align = "left";
	elements.h2.color = "#0369a1";
	elements.h2.marginTop = 16;
	elements.h2.marginBottom = 6;
	elements.h3.fontSize = 11.5;
	elements.h3.color = "#0284c7";
	elements.body.fontSize = 9.5;
	elements.body.lineHeight = 150;
	elements.body.color = "#334155";
	elements.blockquote.fontSize = 9.5;
	elements.blockquote.color = "#0369a1";
	elements.blockquote.backgroundColor = "#e0f2fe";
	elements.blockquote.framePreset = "outline-card";
	elements.list.fontSize = 9.5;
	elements.list.lineHeight = 145;
	elements.codeInline.color = "#0e7490";
	elements.codeInline.backgroundColor = "#ecfeff";
	elements.codeBlock.backgroundColor = "#0f172a";
	elements.codeBlock.color = "#e2e8f0";
	elements.codeBlock.fontSize = 8.5;
	elements.table.fontSize = 9;
	elements.tableHeader.fontSize = 9;
	elements.tableHeader.backgroundColor = "#0369a1";
	elements.tableHeader.color = "#ffffff";
	elements.callout.backgroundColor = "#f0f9ff";
	elements.callout.fontSize = 9.5;
	elements.callout.framePreset = "outline-card";
	elements.link.color = "#0284c7";
	elements.hr.color = "#bae6fd";
	elements.embed.backgroundColor = "#f8fafc";
	elements.embed.framePreset = "outline-card";
	elements.footnote.fontSize = 8;
	return {
		id: "plan",
		name: "Proposal",
		page: basePage({
			marginTopMm: 18,
			marginBottomMm: 16,
			marginLeftMm: 16,
			marginRightMm: 16,
			lineHeight: 150,
			pageNumber: "top-center",
			pageNumberFormat: "{page} / {pages}",
			useFilenameAsTitle: true,
			headerText: "Proposal",
			headerAlign: "right",
			footerText: "",
		}),
		elements,
		special: createDefaultSpecialOptions({ styleOrderedListsAsHeadings: true }),
	};
}

export function createSampleProfiles(): Profile[] {
	return [createReportProfile(), createLifeProfile(), createPlanProfile()];
}

export function createDefaultSettings(): BeautifulPdfSettings {
	const profiles = createSampleProfiles();
	return {
		settingsVersion: 3,
		activeProfileId: profiles[0].id,
		profiles,
	};
}

export function getActiveProfile(settings: BeautifulPdfSettings): Profile {
	return (
		settings.profiles.find((p) => p.id === settings.activeProfileId) ??
		settings.profiles[0]
	);
}

export function cloneProfile(profile: Profile, newName: string): Profile {
	return {
		id: `profile-${Date.now()}`,
		name: newName,
		page: { ...profile.page },
		elements: cloneElements(profile.elements),
		special: { ...profile.special },
	};
}

export function createBlankProfile(name: string): Profile {
	const base = createReportProfile();
	return {
		id: `profile-${Date.now()}`,
		name,
		page: { ...base.page },
		elements: cloneElements(base.elements),
		special: { ...base.special },
	};
}
