/** CSS keys in camelCase (Obsidian setCssStyles convention). */
export type CssRecord = Record<string, string>;

function camelToKebab(key: string): string {
	return key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

type StyledEl = HTMLElement & {
	setCssStyles?: (styles: CssRecord) => void;
};

/** Apply inline styles via Obsidian helpers or style.setProperty (lint-safe). */
export function applyElStyles(el: HTMLElement, styles: CssRecord): void {
	const obs = el as StyledEl;
	if (typeof obs.setCssStyles === "function") {
		obs.setCssStyles(styles);
		return;
	}
	for (const [key, value] of Object.entries(styles)) {
		el.style.setProperty(camelToKebab(key), value);
	}
}

/** Remove inline style properties. */
export function clearElStyles(el: HTMLElement, keys: string[]): void {
	for (const key of keys) {
		el.style.removeProperty(camelToKebab(key));
	}
}

/** Read an inline style property (camelCase key). */
export function readElStyle(el: HTMLElement, key: string): string {
	return el.style.getPropertyValue(camelToKebab(key));
}
