export function htmlElement(el: Element | null | undefined): HTMLElement | null {
	return el?.instanceOf(HTMLElement) ? el : null;
}

export function htmlTable(el: Element | null | undefined): HTMLTableElement | null {
	return el?.instanceOf(HTMLTableElement) ? el : null;
}

export function htmlTableCell(
	el: Element | null | undefined,
): HTMLTableCellElement | null {
	return el?.instanceOf(HTMLTableCellElement) ? el : null;
}

export function htmlTableRow(el: Element | null | undefined): HTMLTableRowElement | null {
	return el?.instanceOf(HTMLTableRowElement) ? el : null;
}

export function htmlTableCols(group: Element): HTMLTableColElement[] {
	return Array.from(group.children).filter(
		(c): c is HTMLTableColElement => c.instanceOf(HTMLTableColElement),
	);
}
