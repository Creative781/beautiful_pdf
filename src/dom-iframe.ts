type DomInfo = {
	cls?: string;
	attr?: Record<string, string>;
	text?: string;
};

type ObsidianWindow = Window & {
	createDiv?: (o?: DomInfo) => HTMLDivElement;
	createEl?: <K extends keyof HTMLElementTagNameMap>(
		tag: K,
		o?: DomInfo,
	) => HTMLElementTagNameMap[K];
};

type ObsidianDocument = Document & { win?: ObsidianWindow };

function obsidianWin(doc: Document): ObsidianWindow {
	const d = doc as ObsidianDocument;
	return d.win ?? doc.defaultView ?? window;
}

/**
 * DOM helpers for table/image editor iframes (srcdoc).
 * Prefer Obsidian's per-document `win.createDiv/createEl`; fall back to createElement.
 */

export function iframeCreateDiv(
	parent: HTMLElement,
	cls: string,
	attrs?: Record<string, string>,
): HTMLDivElement {
	const win = obsidianWin(parent.ownerDocument);
	if (typeof win.createDiv === "function") {
		const el = win.createDiv({ cls, attr: attrs });
		parent.appendChild(el);
		return el;
	}
	const el = parent.ownerDocument.createElement("div");
	el.className = cls;
	if (attrs) {
		for (const [k, v] of Object.entries(attrs)) {
			el.setAttribute(k, v);
		}
	}
	parent.appendChild(el);
	return el;
}

export function iframeInsertDiv(
	parent: HTMLElement,
	before: Node | null,
	cls: string,
	text?: string,
): HTMLDivElement {
	const win = obsidianWin(parent.ownerDocument);
	if (typeof win.createDiv === "function") {
		const el = win.createDiv({ cls, text });
		parent.insertBefore(el, before);
		return el;
	}
	const el = parent.ownerDocument.createElement("div");
	el.className = cls;
	if (text) el.textContent = text;
	parent.insertBefore(el, before);
	return el;
}

export function iframeEnsureColgroup(table: HTMLTableElement): HTMLElement {
	const existing = table.querySelector("colgroup");
	if (existing) return existing;
	const doc = table.ownerDocument;
	const win = obsidianWin(doc);
	const group =
		typeof win.createEl === "function"
			? win.createEl("colgroup")
			: doc.createElement("colgroup");
	table.insertBefore(group, table.firstChild);
	return group;
}

export function iframeAppendCol(group: Element): HTMLTableColElement {
	const doc = group.ownerDocument;
	const win = obsidianWin(doc);
	const col =
		typeof win.createEl === "function"
			? win.createEl("col")
			: doc.createElement("col");
	group.appendChild(col);
	return col;
}
