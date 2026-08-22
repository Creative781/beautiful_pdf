import type { NoteTableLayouts } from "./table-layout";
import type { NoteImageLayouts } from "./image-layout";

export type { NoteTableLayouts, TableLayout } from "./table-layout";
export type { NoteImageLayouts, ImageLayout, ImageAlign } from "./image-layout";

export type TextAlign = "left" | "center" | "right" | "justify";
export type FontWeight = "normal" | "bold" | "300" | "500" | "600" | "700";
export type PageSize = "A4" | "Letter" | "Legal" | "Custom";
export type FramePreset = "accent-bar" | "outline-card" | "soft-fill";
export type HrPreset =
	| "solid"
	| "thick"
	| "double"
	| "dashed"
	| "fade"
	| "short";

export interface ElementStyle {
	fontFamily: string;
	fontSize: number; // pt
	fontWeight: FontWeight;
	align: TextAlign;
	color: string;
	/** Optional fill behind the element (code, callout, table header, etc.). */
	backgroundColor?: string;
	/**
	 * Box chrome for quote / callout / embed.
	 * accent-bar = current left bar; outline-card = full border; soft-fill = fill only.
	 */
	framePreset?: FramePreset;
	/** Horizontal rule line style (Markdown `---`). */
	hrPreset?: HrPreset;
	marginTop: number; // pt
	marginBottom: number; // pt
	/** Line height as percent (100 = 100%). */
	lineHeight?: number;
	paddingLeft?: number; // pt
}

export type ElementKey =
	| "h1"
	| "h2"
	| "h3"
	| "h4"
	| "h5"
	| "h6"
	| "body"
	| "blockquote"
	| "list"
	| "taskList"
	| "codeInline"
	| "codeBlock"
	| "hr"
	| "table"
	| "tableHeader"
	| "callout"
	| "calloutTitle"
	| "image"
	| "link"
	| "footnote"
	| "embed";

export type ElementStyles = Record<ElementKey, ElementStyle>;

export const FRAME_PRESET_OPTIONS: {
	id: FramePreset;
	label: string;
}[] = [
	{ id: "accent-bar", label: "Accent bar (left edge)" },
	{ id: "outline-card", label: "Outline card" },
	{ id: "soft-fill", label: "Soft fill (no border)" },
];

export const HR_PRESET_OPTIONS: {
	id: HrPreset;
	label: string;
}[] = [
	{ id: "solid", label: "Thin solid" },
	{ id: "thick", label: "Thick solid" },
	{ id: "double", label: "Double line" },
	{ id: "dashed", label: "Dashed" },
	{ id: "fade", label: "Soft fade" },
	{ id: "short", label: "Short center bar" },
];

export const ELEMENTS_WITH_FRAME: ElementKey[] = [
	"blockquote",
	"callout",
	"embed",
];

export interface PageSettings {
	pageSize: PageSize;
	pageWidthMm: number;
	pageHeightMm: number;
	marginTopMm: number;
	marginBottomMm: number;
	marginLeftMm: number;
	marginRightMm: number;
	/** Body line height as percent (100 = 100%). */
	lineHeight: number;
	useFilenameAsTitle: boolean;
	/** Header band: left / center / right. Empty = none. */
	headerLeft: string;
	headerCenter: string;
	headerRight: string;
	footerLeft: string;
	footerCenter: string;
	footerRight: string;
	/** Markdown element style key for each slot. Empty = default header/footer look. */
	headerLeftStyle: string;
	headerCenterStyle: string;
	headerRightStyle: string;
	footerLeftStyle: string;
	footerCenterStyle: string;
	footerRightStyle: string;
	printBackground: boolean;
}

/** PDF-only extras that are not plain Markdown element styles. */
export interface SpecialOptions {
	/**
	 * Keep Markdown ordered lists (`1. …`) in the note, but in the PDF render
	 * those list items with a heading style (numbers stay; # headings stay normal).
	 */
	styleOrderedListsAsHeadings: boolean;
	/** Heading style (1=H1 … 6=H6) for top-level `ol > li`. */
	orderedListHeadingLevel1: number;
	/** Heading style for second-level nested `ol ol > li`. */
	orderedListHeadingLevel2: number;
	/** Heading style for third-level nested `ol ol ol > li`. */
	orderedListHeadingLevel3: number;
	/** Honor `%%pdf-pagebreak%%` markers in PDF output. Default on. */
	enablePageBreaks: boolean;
	/** Show Adjust tables UI and apply saved table layouts. Default on. */
	enableTableAdjust: boolean;
	/** Show Adjust images UI and apply saved image layouts. Default on. */
	enableImageAdjust: boolean;
	/** Expand {{page}}, {{title}}, … in header/footer. Default on. */
	enablePlaceholders: boolean;
}

export interface Profile {
	id: string;
	name: string;
	page: PageSettings;
	elements: ElementStyles;
	special: SpecialOptions;
}

export function createDefaultSpecialOptions(
	overrides: Partial<SpecialOptions> = {},
): SpecialOptions {
	return {
		styleOrderedListsAsHeadings: false,
		orderedListHeadingLevel1: 2,
		orderedListHeadingLevel2: 3,
		orderedListHeadingLevel3: 4,
		enablePageBreaks: true,
		enableTableAdjust: true,
		enableImageAdjust: true,
		enablePlaceholders: true,
		...overrides,
	};
}

export interface BeautifulPdfSettings {
	/** Bump when sample profiles should be refreshed for existing installs. */
	settingsVersion?: number;
	activeProfileId: string;
	profiles: Profile[];
	/**
	 * Optional per-note table column/row layouts from the Adjust tables step.
	 * Keyed by vault-relative file path.
	 */
	tableLayouts?: Record<string, NoteTableLayouts>;
	/**
	 * Optional per-note image size/alignment from the Adjust images step.
	 * Keyed by vault-relative file path.
	 */
	imageLayouts?: Record<string, NoteImageLayouts>;
}
export const ELEMENT_LABELS: Record<ElementKey, string> = {
	h1: "Heading # (H1)",
	h2: "Heading ## (H2)",
	h3: "Heading ### (H3)",
	h4: "Heading #### (H4)",
	h5: "Heading ##### (H5)",
	h6: "Heading ###### (H6)",
	body: "Body",
	blockquote: "Blockquote",
	list: "List",
	taskList: "Task list",
	codeInline: "Inline code",
	codeBlock: "Code block",
	hr: "Horizontal rule",
	table: "Table body",
	tableHeader: "Table header",
	callout: "Callout",
	calloutTitle: "Callout title",
	image: "Image",
	link: "Link",
	footnote: "Footnote",
	embed: "Embed",
};

export const ELEMENT_KEYS = Object.keys(ELEMENT_LABELS) as ElementKey[];

/** Settings UI groups for markdown elements. */
export const ELEMENT_GROUPS: { id: string; label: string; keys: ElementKey[] }[] = [
	{ id: "headings", label: "Headings", keys: ["h1", "h2", "h3", "h4", "h5", "h6"] },
	{ id: "body", label: "Body · quote", keys: ["body", "blockquote"] },
	{ id: "lists", label: "Lists", keys: ["list", "taskList"] },
	{ id: "code", label: "Code", keys: ["codeInline", "codeBlock"] },
	{ id: "table", label: "Tables", keys: ["table", "tableHeader"] },
	{ id: "callout", label: "Callouts", keys: ["callout", "calloutTitle"] },
	{ id: "misc", label: "Other", keys: ["hr", "image", "link", "footnote", "embed"] },
];

export const ELEMENT_PREVIEW_TEXT: Record<ElementKey, string> = {
	h1: "Heading sample (#)",
	h2: "Heading sample (##)",
	h3: "Heading sample (###)",
	h4: "Heading sample (####)",
	h5: "Heading sample (#####)",
	h6: "Heading sample (######)",
	body: "Body text looks like this. Check line height and font size.",
	blockquote: "A blockquote sample. Check the left border and colors.",
	list: "• List item sample",
	taskList: "☑ Task list item sample",
	codeInline: "const x = 1",
	codeBlock: "function hello() {\n  return true;\n}",
	hr: "────────",
	table: "Table cell sample",
	tableHeader: "Table header sample",
	callout: "Callout body sample.",
	calloutTitle: "Callout title",
	image: "[ Image align · spacing ]",
	link: "Link text sample",
	footnote: "Footnote sample¹",
	embed: "Embed preview area",
};

/** Elements that expose a background color control in settings. */
export const ELEMENTS_WITH_BACKGROUND: ElementKey[] = [
	"blockquote",
	"codeInline",
	"codeBlock",
	"tableHeader",
	"callout",
	"embed",
];

export const SETTINGS_VERSION = 3;
