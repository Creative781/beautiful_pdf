type ElementCtor<T> = abstract new (...args: never) => T;

type ElementWithObsidianInstanceOf = Element & {
	instanceOf?: <U>(ctor: ElementCtor<U>) => boolean;
};

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function isElementNode(el: unknown): el is Element {
	if (el == null || typeof el !== "object") return false;
	const node = el as { nodeType?: unknown };
	return node.nodeType === ELEMENT_NODE;
}

/**
 * Obsidian adds cross-realm `instanceOf` on app-window nodes.
 * Table/image editors run in iframes: use that element's realm constructors.
 */
function elementInstanceOf<T>(el: unknown, ctor: ElementCtor<T>): el is T {
	if (el == null || typeof el !== "object") return false;
	const node = el as ElementWithObsidianInstanceOf;
	if (typeof node.instanceOf === "function") {
		return node.instanceOf(ctor);
	}
	if (el instanceof ctor) return true;
	if (!isElementNode(el)) return false;
	const realm = el.ownerDocument?.defaultView;
	if (!realm) return false;
	const realmCtor = (realm as unknown as Record<string, unknown>)[ctor.name];
	if (typeof realmCtor !== "function") return false;
	const proto = (realmCtor as { prototype?: object }).prototype;
	if (!proto) return false;
	return Object.prototype.isPrototypeOf.call(proto, el) as boolean;
}

/** Event target safe across iframe realms and text-node hits. */
export function eventTargetElement(
	ev: { target: EventTarget | null },
): HTMLElement | null {
	const t = ev.target;
	if (t == null || typeof t !== "object") return null;
	const node = t as { nodeType?: number; parentElement?: Element | null };
	if (node.nodeType === ELEMENT_NODE) {
		return htmlElement(t as Element);
	}
	if (node.nodeType === TEXT_NODE) {
		return htmlElement(node.parentElement ?? null);
	}
	return null;
}

export function htmlElement(el: Element | null | undefined): HTMLElement | null {
	return elementInstanceOf(el, HTMLElement) ? el : null;
}

export function htmlTable(el: Element | null | undefined): HTMLTableElement | null {
	return elementInstanceOf(el, HTMLTableElement) ? el : null;
}

export function htmlTableCell(
	el: Element | null | undefined,
): HTMLTableCellElement | null {
	return elementInstanceOf(el, HTMLTableCellElement) ? el : null;
}

export function htmlTableRow(el: Element | null | undefined): HTMLTableRowElement | null {
	return elementInstanceOf(el, HTMLTableRowElement) ? el : null;
}

export function htmlTableCols(group: Element): HTMLTableColElement[] {
	return Array.from(group.children).filter((c): c is HTMLTableColElement =>
		elementInstanceOf(c, HTMLTableColElement),
	);
}
