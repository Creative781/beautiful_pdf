export type TextAlign = "left" | "center" | "right" | "justify";
export type HfAlign = "left" | "center" | "right";
export type FontWeight = "normal" | "bold" | "300" | "500" | "600" | "700";
export type PageSize = "A4" | "Letter" | "Legal" | "Custom";
export type PageNumberPos = "none" | "bottom-center" | "bottom-right" | "top-center";
export type FramePreset = "accent-bar" | "outline-card" | "soft-fill";

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
	{ id: "accent-bar", label: "강조선 (왼쪽 세로줄)" },
	{ id: "outline-card", label: "테두리 카드" },
	{ id: "soft-fill", label: "소프트 채움 (선 없음)" },
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
	pageNumber: PageNumberPos;
	pageNumberFormat: string; // e.g. "{page} / {pages}"
	useFilenameAsTitle: boolean;
	headerText: string;
	headerAlign: HfAlign;
	footerText: string;
	footerAlign: HfAlign;
	printBackground: boolean;
}

export interface Profile {
	id: string;
	name: string;
	page: PageSettings;
	elements: ElementStyles;
}

export interface BeautifulPdfSettings {
	/** Bump when sample profiles should be refreshed for existing installs. */
	settingsVersion?: number;
	activeProfileId: string;
	profiles: Profile[];
}

export const ELEMENT_LABELS: Record<ElementKey, string> = {
	h1: "제목 # (H1)",
	h2: "제목 ## (H2)",
	h3: "제목 ### (H3)",
	h4: "제목 #### (H4)",
	h5: "제목 ##### (H5)",
	h6: "제목 ###### (H6)",
	body: "본문",
	blockquote: "인용",
	list: "리스트",
	taskList: "체크박스",
	codeInline: "인라인 코드",
	codeBlock: "코드 블록",
	hr: "구분선",
	table: "표 본문",
	tableHeader: "표 헤더",
	callout: "콜아웃",
	calloutTitle: "콜아웃 제목",
	image: "이미지",
	link: "링크",
	footnote: "각주",
	embed: "임베드",
};

export const ELEMENT_KEYS = Object.keys(ELEMENT_LABELS) as ElementKey[];

/** Settings UI groups for markdown elements. */
export const ELEMENT_GROUPS: { id: string; label: string; keys: ElementKey[] }[] = [
	{ id: "headings", label: "제목", keys: ["h1", "h2", "h3", "h4", "h5", "h6"] },
	{ id: "body", label: "본문 · 인용", keys: ["body", "blockquote"] },
	{ id: "lists", label: "리스트", keys: ["list", "taskList"] },
	{ id: "code", label: "코드", keys: ["codeInline", "codeBlock"] },
	{ id: "table", label: "표", keys: ["table", "tableHeader"] },
	{ id: "callout", label: "콜아웃", keys: ["callout", "calloutTitle"] },
	{ id: "misc", label: "기타", keys: ["hr", "image", "link", "footnote", "embed"] },
];

export const ELEMENT_PREVIEW_TEXT: Record<ElementKey, string> = {
	h1: "제목 예시 (#)",
	h2: "제목 예시 (##)",
	h3: "제목 예시 (###)",
	h4: "제목 예시 (####)",
	h5: "제목 예시 (#####)",
	h6: "제목 예시 (######)",
	body: "본문 단락이 이렇게 보입니다. 행간과 글자 크기를 확인하세요.",
	blockquote: "인용문입니다. 왼쪽 테두리와 색을 확인하세요.",
	list: "• 리스트 항목 예시",
	taskList: "☑ 체크박스 항목 예시",
	codeInline: "const x = 1",
	codeBlock: "function hello() {\n  return true;\n}",
	hr: "────────",
	table: "표 셀 텍스트 예시",
	tableHeader: "표 헤더 예시",
	callout: "콜아웃 본문 예시입니다.",
	calloutTitle: "콜아웃 제목",
	image: "[ 이미지 정렬 · 여백 ]",
	link: "링크 텍스트 예시",
	footnote: "각주 내용 예시¹",
	embed: "임베드 미리보기 영역",
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

export const SETTINGS_VERSION = 2;
