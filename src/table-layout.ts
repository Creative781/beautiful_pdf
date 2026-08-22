/** Per-table column/row sizing saved from the optional layout step. */
import { applyElStyles, clearElStyles, readElStyle } from "./dom-style";
import { htmlElement, htmlTable, htmlTableCols } from "./dom-guards";
export type TableAlign = "left" | "center" | "right";

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
	/** Block alignment of the table on the page (not cell text align). */
	align?: TableAlign;
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
		group = table.createEl("colgroup");
		table.insertBefore(group, table.firstChild);
	}
	while (group.children.length > colCount) {
		group.lastElementChild?.remove();
	}
	while (group.children.length < colCount) {
		group.createEl("col");
	}
	return htmlTableCols(group);
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

/** Block-level left / center / right for the table (not cell contents). */
export function applyTableBlockAlign(
	table: HTMLTableElement,
	align: TableAlign,
): void {
	markTableTouched(table);
	const a: TableAlign =
		align === "center" || align === "right" ? align : "left";
	table.dataset.bpfAlign = a;
	if (a === "center") {
		applyElStyles(table, { marginLeft: "auto", marginRight: "auto" });
	} else if (a === "right") {
		applyElStyles(table, { marginLeft: "auto", marginRight: "0" });
	} else {
		applyElStyles(table, { marginLeft: "0", marginRight: "auto" });
	}
	const wrap = table.parentElement;
	if (wrap?.classList.contains("bpf-table-wrap")) {
		wrap.dataset.align = a;
	}
}

export function readTableBlockAlign(table: HTMLTableElement): TableAlign {
	const raw = table.dataset.bpfAlign;
	if (raw === "center" || raw === "right") return raw;
	return "left";
}

/**
 * Drop absolute px floors on cols/cells left by applyNoteTableLayouts / PDF bake.
 * Those min/max widths block right-edge shrink even when table.style.width falls.
 */
export function clearColumnPixelConstraints(table: HTMLTableElement): void {
	const group = table.querySelector("colgroup");
	if (group) {
		for (const col of htmlTableCols(group)) {
			clearElStyles(col, ["minWidth", "maxWidth", "width"]);
			col.removeAttribute("width");
		}
	}
	for (const row of Array.from(table.rows)) {
		for (const cell of Array.from(row.cells)) {
			clearElStyles(cell, ["width", "minWidth", "maxWidth"]);
			cell.removeAttribute("width");
		}
	}
}

/**
 * Keep the table's current pixel width (do not stretch to 100%).
 * Needed before `table-layout: fixed` so column drags only redistribute.
 */
export function lockTablePixelWidth(table: HTMLTableElement): void {
	markTableTouched(table);
	const existing = readElStyle(table, "width");
	if (existing && existing !== "100%" && existing !== "auto") {
		// Still clear stale px floors so subsequent shrinks can take effect.
		clearColumnPixelConstraints(table);
		return;
	}
	const w = Math.round(table.getBoundingClientRect().width);
	const px = Math.max(40, w);
	applyElStyles(table, {
		width: `${px}px`,
		minWidth: `${px}px`,
		maxWidth: `${px}px`,
	});
	clearColumnPixelConstraints(table);
}

export function setTablePixelWidth(table: HTMLTableElement, widthPx: number): void {
	markTableTouched(table);
	const px = Math.max(40, Math.round(widthPx));
	applyElStyles(table, {
		width: `${px}px`,
		minWidth: `${px}px`,
		maxWidth: `${px}px`,
		tableLayout: "fixed",
	});
	clearColumnPixelConstraints(table);
}

export function setTablePixelHeight(table: HTMLTableElement, heightPx: number): void {
	markTableTouched(table);
	applyElStyles(table, {
		height: `${Math.max(24, Math.round(heightPx))}px`,
	});
}

function layoutParent(table: HTMLTableElement): HTMLElement | null {
	return htmlElement(table.closest(".markdown-preview-view")) ?? table.parentElement;
}

/** Table width as % of the note content column (padding excluded). */
export function measureTableWidthPct(table: HTMLTableElement): number | undefined {
	const parent = layoutParent(table);
	if (!parent) return undefined;
	const style = getComputedStyle(parent);
	const padX =
		(parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
	const pw =
		(parent.clientWidth || parent.getBoundingClientRect().width) - padX;
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
		const styleW = readElStyle(cols[i], "width");
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
	clearColumnPixelConstraints(table);
	const n = Math.max(tableColumnCount(table), colWidthsPct.length);
	const pct = normalizePercents(
		colWidthsPct.length === n
			? colWidthsPct
			: padOrTrim(colWidthsPct, n, 100 / Math.max(1, n)),
	);
	const cols = ensureColgroup(table, n);
	for (let i = 0; i < n; i++) {
		applyElStyles(cols[i], { width: `${pct[i]}%` });
		clearElStyles(cols[i], ["minWidth", "maxWidth"]);
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
			applyElStyles(rows[i], { height: `${h}px` });
		}
	}
}

/**
 * Remove editor-only chrome so capture/PDF never see handles or wrappers.
 */
export function stripEditorChrome(root: HTMLElement): void {
		root
		.querySelectorAll(
			".bpf-col-handle, .bpf-row-handle, .bpf-edge-handle-right, .bpf-edge-handle-bottom, .bpf-table-hint",
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
 * Print/PDF CSS using absolute mm widths. Percentage widths often resolve to
 * "auto" during Electron printToPDF when the containing block is indefinite.
 */
export function tableLayoutsToCss(
	layouts: NoteTableLayouts | null | undefined,
	contentWidthMm: number,
): string {
	if (!layouts?.tables?.length) return "";
	const pageMm = Math.max(40, contentWidthMm);
	const lines: string[] = [
		`html, body, .markdown-preview-view { width:${pageMm}mm !important; max-width:${pageMm}mm !important; margin:0 !important; box-sizing:border-box !important; }`,
	];
	for (const layout of layouts.tables) {
		const t = `table[data-bpf-i="${layout.index}"]`;
		const tableMm =
			layout.widthPct != null && layout.widthPct > 0
				? (Math.min(100, Math.max(5, layout.widthPct)) / 100) * pageMm
				: pageMm;
		const heightRule =
			layout.heightPx != null && layout.heightPx > 0
				? `height:${pxToMm(layout.heightPx)}mm !important;`
				: "";
		lines.push(
			`${t}{table-layout:fixed !important;width:${fmtMm(tableMm)}mm !important;min-width:${fmtMm(tableMm)}mm !important;max-width:${fmtMm(tableMm)}mm !important;${heightRule}${alignRule(layout.align)}}`,
		);
		const pct = normalizePercents(layout.colWidthsPct || []);
		pct.forEach((p, i) => {
			const colMm = (p / 100) * tableMm;
			const w = `${fmtMm(colMm)}mm`;
			lines.push(
				`${t} > colgroup > col:nth-child(${i + 1}){width:${w} !important;min-width:${w} !important;max-width:${w} !important;}`,
			);
			lines.push(
				`${t} th:nth-child(${i + 1}), ${t} td:nth-child(${i + 1}),` +
					`${t} > thead > tr > *:nth-child(${i + 1}),` +
					`${t} > tbody > tr > *:nth-child(${i + 1}),` +
					`${t} > tr > *:nth-child(${i + 1}){width:${w} !important;min-width:${w} !important;max-width:${w} !important;box-sizing:border-box !important;}`,
			);
		});
		if (layout.rowHeightsPx?.length) {
			layout.rowHeightsPx.forEach((h, i) => {
				if (h == null || h <= 0) return;
				lines.push(
					`${t} tr[data-bpf-r="${i}"], ${t} tr:nth-child(${i + 1}){height:${pxToMm(h)}mm !important;}`,
				);
			});
		}
	}
	return lines.join("\n");
}

function pxToMm(px: number): string {
	return fmtMm((px / 96) * 25.4);
}

function fmtMm(mm: number): string {
	return Number(mm.toFixed(3)).toString();
}

function alignRule(align: TableAlign | undefined): string {
	if (align === "center") {
		return "margin-left:auto !important;margin-right:auto !important;";
	}
	if (align === "right") {
		return "margin-left:auto !important;margin-right:0 !important;";
	}
	if (align === "left") {
		return "margin-left:0 !important;margin-right:auto !important;";
	}
	return "";
}

/**
 * Apply saved layouts onto rendered note HTML (by table index).
 * Uses absolute px against `contentWidthPx` so serialized HTML survives printToPDF.
 */
export function applyNoteTableLayouts(
	root: HTMLElement,
	layouts: NoteTableLayouts | null | undefined,
	contentWidthPx?: number,
): void {
	if (!layouts?.tables?.length) return;
	const parentW = Math.max(
		40,
		contentWidthPx ??
			(root.clientWidth || root.getBoundingClientRect().width || 794),
	);
	const tables = Array.from(root.querySelectorAll("table"));
	for (const layout of layouts.tables) {
		const table = htmlTable(tables[layout.index]);
		if (!table) continue;
		table.classList.add("bpf-table-sized");
		table.setAttribute("data-bpf-i", String(layout.index));
		applyElStyles(table, {
			tableLayout: "fixed",
			boxSizing: "border-box",
		});

		const tablePx =
			layout.widthPct != null && layout.widthPct > 0
				? Math.max(
						40,
						(Math.min(100, Math.max(5, layout.widthPct)) / 100) * parentW,
					)
				: Math.max(40, table.getBoundingClientRect().width || parentW);
		const tablePxR = Math.round(tablePx);
		applyElStyles(table, {
			width: `${tablePxR}px`,
			minWidth: `${tablePxR}px`,
			maxWidth: `${tablePxR}px`,
		});

		if (layout.colWidthsPct?.length) {
			const n = Math.max(tableColumnCount(table), layout.colWidthsPct.length);
			const pct = normalizePercents(
				layout.colWidthsPct.length === n
					? layout.colWidthsPct
					: padOrTrim(layout.colWidthsPct, n, 100 / Math.max(1, n)),
			);
			const cols = ensureColgroup(table, n);
			const colPx = pct.map((p) => Math.max(8, Math.round((p / 100) * tablePx)));
			for (let i = 0; i < n; i++) {
				const w = `${colPx[i]}px`;
				applyElStyles(cols[i], {
					width: w,
					minWidth: w,
					maxWidth: w,
				});
				cols[i].setAttribute("width", String(colPx[i]));
			}
			for (const row of Array.from(table.rows)) {
				let colAt = 0;
				for (const cell of Array.from(row.cells)) {
					const span = cell.colSpan || 1;
					let spanPx = 0;
					for (let k = 0; k < span && colAt + k < n; k++) {
						spanPx += colPx[colAt + k];
					}
					if (spanPx > 0) {
						const w = `${spanPx}px`;
						applyElStyles(cell, {
							width: w,
							minWidth: w,
							maxWidth: w,
							boxSizing: "border-box",
						});
						cell.setAttribute("width", String(spanPx));
					}
					colAt += span;
				}
			}
		}

		if (layout.rowHeightsPx?.length) {
			const rows = Array.from(table.rows);
			for (let i = 0; i < rows.length; i++) {
				rows[i].setAttribute("data-bpf-r", String(i));
				const h = layout.rowHeightsPx[i];
				if (h != null && h > 0) {
					applyElStyles(rows[i], { height: `${Math.round(h)}px` });
				}
			}
		}

		if (layout.heightPx != null && layout.heightPx > 0) {
			applyElStyles(table, { height: `${Math.round(layout.heightPx)}px` });
		}

		if (layout.align) {
			applyTableBlockAlign(table, layout.align);
		}
	}
}

function tableHasCustomSizing(table: HTMLTableElement): boolean {
	if (table.dataset.bpfTouched === "1") return true;
	if (table.classList.contains("bpf-table-sized")) return true;
	if (table.dataset.bpfAlign && table.dataset.bpfAlign !== "left") return true;
	if (readElStyle(table, "width") || readElStyle(table, "height")) return true;
	if (table.querySelector("colgroup")) return true;
	if (Array.from(table.rows).some((r) => !!readElStyle(r, "height"))) return true;
	return false;
}

/**
 * Snapshot layouts. Measures WHILE chrome may still be present (more accurate),
 * then strips chrome so leftover editor nodes are not counted as tables.
 */
export function captureNoteTableLayouts(root: HTMLElement): NoteTableLayouts {
	const tablesBefore = Array.from(root.querySelectorAll("table")).filter(
		(el): el is HTMLTableElement => el.instanceOf(HTMLTableElement),
	);
	const snapshots: TableLayout[] = [];
	tablesBefore.forEach((table, index) => {
		if (!tableHasCustomSizing(table)) return;
		const colWidthsPct = measureColWidthsPct(table);
		const hasRowOverride = Array.from(table.rows).some(
			(r) => !!readElStyle(r, "height"),
		);
		const heightPx = parseFloat(readElStyle(table, "height"));
		const rowHeightsPx = Array.from(table.rows).map((row) => {
			const h = parseFloat(readElStyle(row, "height"));
			if (Number.isFinite(h) && h > 0) return h;
			return Math.round(row.getBoundingClientRect().height);
		});
		const widthPct = measureTableWidthPct(table);
		const align = readTableBlockAlign(table);
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
			align,
		});
	});
	stripEditorChrome(root);
	// Re-resolve indices after unwrap (should match; re-map by order among remaining tables)
	const tablesAfter = Array.from(root.querySelectorAll("table"));
	for (const snap of snapshots) {
		const still = htmlTable(tablesAfter[snap.index]);
		if (still) markTableTouched(still);
	}
	return { tables: snapshots };
}

/** Clear sizing classes/styles on all tables (reset). */
export function resetTableSizing(table: HTMLTableElement): void {
	table.classList.remove("bpf-table-sized");
	delete table.dataset.bpfTouched;
	table.removeAttribute("data-bpf-i");
	clearElStyles(table, [
		"width",
		"height",
		"minWidth",
		"maxWidth",
		"tableLayout",
		"marginLeft",
		"marginRight",
	]);
	delete table.dataset.bpfAlign;
	const wrap = table.parentElement;
	if (wrap?.classList.contains("bpf-table-wrap")) {
		wrap.dataset.align = "left";
	}
	clearColumnPixelConstraints(table);
	const group = table.querySelector("colgroup");
	group?.remove();
	for (const row of Array.from(table.rows)) {
		clearElStyles(row, ["height"]);
		row.removeAttribute("data-bpf-r");
	}
}
