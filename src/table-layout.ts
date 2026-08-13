/** Per-table column/row sizing saved from the optional layout step. */
export interface TableLayout {
	/** 0-based index among `table` elements in document order. */
	index: number;
	/** Column widths as percentages of the table width (sum ≈ 100). */
	colWidthsPct: number[];
	/** Optional explicit row heights in CSS pixels. */
	rowHeightsPx?: number[];
	/**
	 * Table width as % of its parent content box (not forced to 100%).
	 * Set when the user resizes columns or the right edge.
	 */
	widthPct?: number;
	/** Optional overall table height in CSS pixels (bottom-edge resize). */
	heightPx?: number;
}

export interface NoteTableLayouts {
	tables: TableLayout[];
}

export function emptyNoteTableLayouts(): NoteTableLayouts {
	return { tables: [] };
}

/** Count columns in a table (max cells across rows). */
export function tableColumnCount(table: HTMLTableElement): number {
	let max = 0;
	for (const row of Array.from(table.rows)) {
		let n = 0;
		for (const cell of Array.from(row.cells)) {
			n += cell.colSpan || 1;
		}
		if (n > max) max = n;
	}
	return max;
}

/** Ensure a colgroup with one col per column; returns the col elements. */
export function ensureColgroup(
	table: HTMLTableElement,
	colCount: number,
): HTMLTableColElement[] {
	let group = table.querySelector("colgroup");
	if (!group) {
		group = table.ownerDocument.createElement("colgroup");
		table.insertBefore(group, table.firstChild);
	}
	while (group.children.length > colCount) {
		group.lastElementChild?.remove();
	}
	while (group.children.length < colCount) {
		group.appendChild(table.ownerDocument.createElement("col"));
	}
	return Array.from(group.children) as HTMLTableColElement[];
}

export function normalizePercents(values: number[]): number[] {
	const cleaned = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
	const sum = cleaned.reduce((a, b) => a + b, 0);
	if (sum <= 0) {
		const even = 100 / Math.max(1, cleaned.length);
		return cleaned.map(() => even);
	}
	return cleaned.map((v) => (v / sum) * 100);
}

/**
 * Keep the table's current pixel width (do not stretch to 100%).
 * Needed before `table-layout: fixed` so column drags only redistribute.
 */
export function lockTablePixelWidth(table: HTMLTableElement): void {
	table.classList.add("bpf-table-sized");
	const existing = table.style.width;
	if (existing && existing !== "100%" && existing !== "auto") return;
	const w = Math.round(table.getBoundingClientRect().width);
	table.style.width = `${Math.max(40, w)}px`;
	table.style.maxWidth = "100%";
}

export function setTablePixelWidth(table: HTMLTableElement, widthPx: number): void {
	table.classList.add("bpf-table-sized");
	table.style.width = `${Math.max(40, Math.round(widthPx))}px`;
	table.style.maxWidth = "100%";
}

export function setTablePixelHeight(table: HTMLTableElement, heightPx: number): void {
	table.classList.add("bpf-table-sized");
	table.style.height = `${Math.max(24, Math.round(heightPx))}px`;
}

/** Table width as % of parent content width. */
export function measureTableWidthPct(table: HTMLTableElement): number | undefined {
	const parent = table.parentElement;
	if (!parent) return undefined;
	const pw = parent.getBoundingClientRect().width;
	if (pw <= 1) return undefined;
	const tw = table.getBoundingClientRect().width;
	return Math.min(100, Math.max(5, (tw / pw) * 100));
}

export function applyTableWidthPct(table: HTMLTableElement, widthPct: number): void {
	const pct = Math.min(100, Math.max(5, widthPct));
	table.classList.add("bpf-table-sized");
	table.style.width = `${pct}%`;
	table.style.maxWidth = "100%";
}

/** Read current column widths as percentages of the table's client width. */
export function measureColWidthsPct(table: HTMLTableElement): number[] {
	const n = tableColumnCount(table);
	if (n === 0) return [];
	const cols = ensureColgroup(table, n);
	const tableW = Math.max(1, table.getBoundingClientRect().width);
	const widths: number[] = [];
	for (let i = 0; i < n; i++) {
		const styleW = cols[i].style.width;
		if (styleW.endsWith("%")) {
			const p = parseFloat(styleW);
			widths.push(Number.isFinite(p) ? p : 0);
			continue;
		}
		const cell = cellAtColumn(table, 0, i);
		if (cell) {
			widths.push((cell.getBoundingClientRect().width / tableW) * 100);
		} else {
			widths.push(100 / n);
		}
	}
	return normalizePercents(widths);
}

function cellAtColumn(
	table: HTMLTableElement,
	rowIndex: number,
	colIndex: number,
): HTMLTableCellElement | null {
	const row = table.rows[rowIndex];
	if (!row) return null;
	let at = 0;
	for (const cell of Array.from(row.cells)) {
		const span = cell.colSpan || 1;
		if (colIndex >= at && colIndex < at + span) return cell;
		at += span;
	}
	return null;
}

/**
 * Apply column % widths. Preserves current table pixel/percent width
 * (does not force full page width).
 */
export function applyColWidthsPct(
	table: HTMLTableElement,
	colWidthsPct: number[],
): void {
	lockTablePixelWidth(table);
	const n = Math.max(tableColumnCount(table), colWidthsPct.length);
	const pct = normalizePercents(
		colWidthsPct.length === n
			? colWidthsPct
			: padOrTrim(colWidthsPct, n, 100 / Math.max(1, n)),
	);
	const cols = ensureColgroup(table, n);
	for (let i = 0; i < n; i++) {
		cols[i].style.width = `${pct[i]}%`;
	}
}

function padOrTrim(arr: number[], n: number, fill: number): number[] {
	const out = arr.slice(0, n);
	while (out.length < n) out.push(fill);
	return out;
}

export function applyRowHeightsPx(
	table: HTMLTableElement,
	rowHeightsPx: number[] | undefined,
): void {
	if (!rowHeightsPx?.length) return;
	const rows = Array.from(table.rows);
	for (let i = 0; i < rows.length; i++) {
		const h = rowHeightsPx[i];
		if (h != null && h > 0) {
			rows[i].style.height = `${h}px`;
		}
	}
}

/** Apply saved layouts onto rendered note HTML (by table index). */
export function applyNoteTableLayouts(
	root: HTMLElement,
	layouts: NoteTableLayouts | null | undefined,
): void {
	if (!layouts?.tables?.length) return;
	const tables = Array.from(root.querySelectorAll("table"));
	for (const layout of layouts.tables) {
		const table = tables[layout.index] as HTMLTableElement | undefined;
		if (!table) continue;
		if (layout.widthPct != null && layout.widthPct > 0) {
			applyTableWidthPct(table, layout.widthPct);
		}
		if (layout.colWidthsPct?.length) {
			applyColWidthsPct(table, layout.colWidthsPct);
			// Prefer saved widthPct over the pixel lock from applyColWidthsPct
			if (layout.widthPct != null && layout.widthPct > 0) {
				applyTableWidthPct(table, layout.widthPct);
			}
		}
		applyRowHeightsPx(table, layout.rowHeightsPx);
		if (layout.heightPx != null && layout.heightPx > 0) {
			setTablePixelHeight(table, layout.heightPx);
		}
	}
}

function tableHasCustomSizing(table: HTMLTableElement): boolean {
	if (table.classList.contains("bpf-table-sized")) return true;
	if (table.style.width || table.style.height) return true;
	if (table.querySelector("colgroup")) return true;
	if (Array.from(table.rows).some((r) => !!r.style.height)) return true;
	return false;
}

/** Snapshot all tables in root into a NoteTableLayouts payload. */
export function captureNoteTableLayouts(root: HTMLElement): NoteTableLayouts {
	const tables = Array.from(root.querySelectorAll("table")) as HTMLTableElement[];
	const out: TableLayout[] = [];
	tables.forEach((table, index) => {
		if (!tableHasCustomSizing(table)) return;
		const colWidthsPct = measureColWidthsPct(table);
		const rowHeightsPx = Array.from(table.rows).map((row) => {
			const h = parseFloat(row.style.height);
			if (Number.isFinite(h) && h > 0) return h;
			return Math.round(row.getBoundingClientRect().height);
		});
		const hasRowOverride = Array.from(table.rows).some((r) => !!r.style.height);
		const heightPx = parseFloat(table.style.height);
		out.push({
			index,
			colWidthsPct,
			rowHeightsPx: hasRowOverride ? rowHeightsPx : undefined,
			widthPct: measureTableWidthPct(table),
			heightPx:
				Number.isFinite(heightPx) && heightPx > 0
					? heightPx
					: undefined,
		});
	});
	return { tables: out };
}

/** Clear sizing classes/styles on all tables (reset). */
export function resetTableSizing(table: HTMLTableElement): void {
	table.classList.remove("bpf-table-sized");
	table.style.width = "";
	table.style.height = "";
	table.style.maxWidth = "";
	const group = table.querySelector("colgroup");
	group?.remove();
	for (const row of Array.from(table.rows)) {
		row.style.height = "";
	}
}
