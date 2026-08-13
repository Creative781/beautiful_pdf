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

export function markTableTouched(table: HTMLTableElement): void {
	table.dataset.bpfTouched = "1";
	table.classList.add("bpf-table-sized");
}

/**
 * Keep the table's current pixel width (do not stretch to 100%).
 * Needed before `table-layout: fixed` so column drags only redistribute.
 */
export function lockTablePixelWidth(table: HTMLTableElement): void {
	markTableTouched(table);
	const existing = table.style.width;
	if (existing && existing !== "100%" && existing !== "auto") return;
	const w = Math.round(table.getBoundingClientRect().width);
	table.style.width = `${Math.max(40, w)}px`;
	table.style.maxWidth = "none";
}

export function setTablePixelWidth(table: HTMLTableElement, widthPx: number): void {
	markTableTouched(table);
	table.style.width = `${Math.max(40, Math.round(widthPx))}px`;
	table.style.maxWidth = "none";
}

export function setTablePixelHeight(table: HTMLTableElement, heightPx: number): void {
	markTableTouched(table);
	table.style.height = `${Math.max(24, Math.round(heightPx))}px`;
}

function layoutParent(table: HTMLTableElement): HTMLElement | null {
	return (
		(table.closest(".markdown-preview-view") as HTMLElement | null) ??
		table.parentElement
	);
}

/** Table width as % of the note content column. */
export function measureTableWidthPct(table: HTMLTableElement): number | undefined {
	const parent = layoutParent(table);
	if (!parent) return undefined;
	const pw = parent.clientWidth || parent.getBoundingClientRect().width;
	if (pw <= 1) return undefined;
	const tw = table.getBoundingClientRect().width;
	return Math.min(100, Math.max(5, (tw / pw) * 100));
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

/**
 * Remove editor-only chrome so capture/PDF never see handles or wrappers.
 */
export function stripEditorChrome(root: HTMLElement): void {
	root
		.querySelectorAll(
			".bpf-col-handle, .bpf-edge-handle-right, .bpf-edge-handle-bottom, .bpf-table-hint",
		)
		.forEach((el) => el.remove());
	root.querySelectorAll(".bpf-cell-selected").forEach((el) => {
		el.classList.remove("bpf-cell-selected");
	});
	root.querySelectorAll(".bpf-table-wrap").forEach((wrap) => {
		const parent = wrap.parentElement;
		if (!parent) return;
		while (wrap.firstChild) {
			parent.insertBefore(wrap.firstChild, wrap);
		}
		wrap.remove();
	});
}

/**
 * Print-time CSS that forces saved layouts. Inline col/tr styles can be lost or
 * ignored by print engines; this is the authoritative path for PDF output.
 */
export function tableLayoutsToCss(
	layouts: NoteTableLayouts | null | undefined,
): string {
	if (!layouts?.tables?.length) return "";
	const lines: string[] = [];
	for (const layout of layouts.tables) {
		const t = `table[data-bpf-i="${layout.index}"]`;
		const widthRule =
			layout.widthPct != null && layout.widthPct > 0
				? `width:${Number(layout.widthPct.toFixed(4))}% !important;`
				: "";
		const heightRule =
			layout.heightPx != null && layout.heightPx > 0
				? `height:${Math.round(layout.heightPx)}px !important;`
				: "";
		lines.push(
			`${t}{table-layout:fixed !important;max-width:100% !important;${widthRule}${heightRule}}`,
		);
		const pct = normalizePercents(layout.colWidthsPct || []);
		pct.forEach((p, i) => {
			const w = `${Number(p.toFixed(4))}%`;
			lines.push(
				`${t} > colgroup > col:nth-child(${i + 1}){width:${w} !important;}`,
			);
			// Cell fallbacks when colgroup is dropped by the serializer/engine
			lines.push(
				`${t} > thead > tr > *:nth-child(${i + 1}),` +
					`${t} > tbody > tr:first-child > *:nth-child(${i + 1}),` +
					`${t} > tr:first-child > *:nth-child(${i + 1}){width:${w} !important;}`,
			);
		});
		if (layout.rowHeightsPx?.length) {
			layout.rowHeightsPx.forEach((h, i) => {
				if (h == null || h <= 0) return;
				lines.push(
					`${t} tr[data-bpf-r="${i}"]{height:${Math.round(h)}px !important;}`,
				);
			});
		}
	}
	return lines.join("\n");
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
		table.classList.add("bpf-table-sized");
		table.setAttribute("data-bpf-i", String(layout.index));

		if (layout.colWidthsPct?.length) {
			const n = Math.max(tableColumnCount(table), layout.colWidthsPct.length);
			const pct = normalizePercents(
				layout.colWidthsPct.length === n
					? layout.colWidthsPct
					: padOrTrim(layout.colWidthsPct, n, 100 / Math.max(1, n)),
			);
			const cols = ensureColgroup(table, n);
			for (let i = 0; i < n; i++) {
				cols[i].style.width = `${pct[i]}%`;
				cols[i].setAttribute("width", `${pct[i]}%`);
			}
		}

		if (layout.widthPct != null && layout.widthPct > 0) {
			const w = `${Math.min(100, Math.max(5, layout.widthPct))}%`;
			table.style.width = w;
			table.style.maxWidth = "100%";
			table.style.tableLayout = "fixed";
		}

		if (layout.rowHeightsPx?.length) {
			const rows = Array.from(table.rows);
			for (let i = 0; i < rows.length; i++) {
				rows[i].setAttribute("data-bpf-r", String(i));
				const h = layout.rowHeightsPx[i];
				if (h != null && h > 0) {
					rows[i].style.height = `${h}px`;
				}
			}
		}

		if (layout.heightPx != null && layout.heightPx > 0) {
			table.style.height = `${Math.round(layout.heightPx)}px`;
		}
	}
}

function tableHasCustomSizing(table: HTMLTableElement): boolean {
	if (table.dataset.bpfTouched === "1") return true;
	if (table.classList.contains("bpf-table-sized")) return true;
	if (table.style.width || table.style.height) return true;
	if (table.querySelector("colgroup")) return true;
	if (Array.from(table.rows).some((r) => !!r.style.height)) return true;
	return false;
}

/**
 * Snapshot layouts. Measures WHILE chrome may still be present (more accurate),
 * then strips chrome so leftover editor nodes are not counted as tables.
 */
export function captureNoteTableLayouts(root: HTMLElement): NoteTableLayouts {
	const tablesBefore = Array.from(
		root.querySelectorAll("table"),
	) as HTMLTableElement[];
	const snapshots: TableLayout[] = [];
	tablesBefore.forEach((table, index) => {
		if (!tableHasCustomSizing(table)) return;
		const colWidthsPct = measureColWidthsPct(table);
		const hasRowOverride = Array.from(table.rows).some((r) => !!r.style.height);
		const heightPx = parseFloat(table.style.height);
		const rowHeightsPx = Array.from(table.rows).map((row) => {
			const h = parseFloat(row.style.height);
			if (Number.isFinite(h) && h > 0) return h;
			return Math.round(row.getBoundingClientRect().height);
		});
		const widthPct = measureTableWidthPct(table);
		snapshots.push({
			index,
			colWidthsPct,
			rowHeightsPx:
				hasRowOverride || (Number.isFinite(heightPx) && heightPx > 0)
					? rowHeightsPx
					: undefined,
			widthPct,
			heightPx:
				Number.isFinite(heightPx) && heightPx > 0 ? heightPx : undefined,
		});
	});
	stripEditorChrome(root);
	// Re-resolve indices after unwrap (should match; re-map by order among remaining tables)
	const tablesAfter = Array.from(root.querySelectorAll("table"));
	for (const snap of snapshots) {
		const still = tablesAfter[snap.index];
		if (still) markTableTouched(still as HTMLTableElement);
	}
	return { tables: snapshots };
}

/** Clear sizing classes/styles on all tables (reset). */
export function resetTableSizing(table: HTMLTableElement): void {
	table.classList.remove("bpf-table-sized");
	delete table.dataset.bpfTouched;
	table.removeAttribute("data-bpf-i");
	table.style.width = "";
	table.style.height = "";
	table.style.maxWidth = "";
	table.style.tableLayout = "";
	const group = table.querySelector("colgroup");
	group?.remove();
	for (const row of Array.from(table.rows)) {
		row.style.height = "";
		row.removeAttribute("data-bpf-r");
	}
}
