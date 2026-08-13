import { App, Modal, Notice, TFile } from "obsidian";
import type BeautifulPdfPlugin from "./main";
import { getActiveProfile } from "./profiles";
import { renderNoteHtml } from "./render";
import {
	applyColWidthsPct,
	captureNoteTableLayouts,
	lockTablePixelWidth,
	markTableTouched,
	measureColWidthsPct,
	normalizePercents,
	resetTableSizing,
	setTablePixelHeight,
	setTablePixelWidth,
	stripEditorChrome,
	tableColumnCount,
	type NoteTableLayouts,
} from "./table-layout";

type CellKey = string; // `${tableIndex}:${row}:${col}`

type DragSelectState = {
	tableIndex: number;
	startRow: number;
	startCol: number;
};

/**
 * Optional HTML step: drag column borders, multi-select cells,
 * equalize width/height, then save layouts for PDF generation.
 */
export class TableAdjustModal extends Modal {
	plugin: BeautifulPdfPlugin;
	file: TFile;
	private onApplied: (layouts: NoteTableLayouts) => void;
	private frameEl: HTMLIFrameElement | null = null;
	private statusEl: HTMLElement | null = null;
	private selected = new Set<CellKey>();
	private activeTableIndex = 0;
	private detachFns: Array<() => void> = [];
	private dragSelect: DragSelectState | null = null;
	private resizing = false;

	constructor(
		app: App,
		plugin: BeautifulPdfPlugin,
		file: TFile,
		onApplied: (layouts: NoteTableLayouts) => void,
	) {
		super(app);
		this.plugin = plugin;
		this.file = file;
		this.onApplied = onApplied;
	}

	onOpen(): void {
		const { contentEl } = this;
		this.modalEl.addClass("beautiful-pdf-table-adjust-modal");
		contentEl.empty();

		contentEl.createEl("h2", { text: "Adjust tables" });

		const tip = contentEl.createDiv({ cls: "beautiful-pdf-tip" });
		tip.setText(
			"Drag across cells to select. Click empty space to clear. Inner column edges redistribute columns; right edge = table width; bottom edge = table height. Then Apply & preview PDF.",
		);

		const toolbar = contentEl.createDiv({ cls: "beautiful-pdf-toolbar" });

		const mk = (label: string, cls: string, fn: () => void) => {
			const b = toolbar.createEl("button", { text: label, cls, attr: { type: "button" } });
			b.onclick = () => fn();
			return b;
		};

		mk("Equalize column widths", "", () => this.equalizeSelectedColumns());
		mk("Equalize row heights", "", () => this.equalizeSelectedRows());
		mk("Reset active table", "", () => this.resetActiveTable());
		mk("Clear all sizing", "", () => this.clearAllSizing());
		mk("Apply & preview PDF", "mod-cta", () => void this.applyAndClose());

		this.statusEl = toolbar.createDiv({
			cls: "beautiful-pdf-status",
			text: "Loading…",
		});

		const wrap = contentEl.createDiv({ cls: "beautiful-pdf-table-adjust-frame" });
		this.frameEl = wrap.createEl("iframe", {
			attr: { title: "Table layout editor" },
		});

		void this.loadHtml();
	}

	onClose(): void {
		this.teardownHandlers();
		this.contentEl.empty();
	}

	private setStatus(text: string): void {
		this.statusEl?.setText(text);
	}

	private doc(): Document | null {
		return this.frameEl?.contentDocument ?? null;
	}

	private root(): HTMLElement | null {
		return this.doc()?.body ?? null;
	}

	private async loadHtml(): Promise<void> {
		try {
			const profile = getActiveProfile(this.plugin.settings);
			const saved = this.plugin.settings.tableLayouts?.[this.file.path] ?? null;
			const rendered = await renderNoteHtml(this.app, this.file, profile, {
				tableLayouts: saved,
			});

			const page = profile.page;
			const widthMm =
				page.pageSize === "Custom"
					? page.pageWidthMm
					: page.pageSize === "Letter" || page.pageSize === "Legal"
						? 215.9
						: 210;
			const contentWidthMm = Math.max(
				40,
				widthMm - page.marginLeftMm - page.marginRightMm,
			);

			const editorCss = `
${rendered.css}
html, body {
  margin: 0;
  padding: 16px;
  background: #f3f4f6;
}
.markdown-preview-view {
  max-width: ${contentWidthMm}mm;
  margin: 0 auto;
  background: #fff;
  padding: 12mm;
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
}
.bpf-table-wrap {
  position: relative;
  display: block;
  width: fit-content;
  max-width: 100%;
  margin: 0 0 8px;
}
table {
  position: relative;
  user-select: none;
  -webkit-user-select: none;
}
td.bpf-cell-selected, th.bpf-cell-selected {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
  background: rgba(37, 99, 235, 0.08) !important;
}
.bpf-col-handle {
  position: absolute;
  top: 0;
  width: 6px;
  margin-left: -3px;
  cursor: col-resize;
  z-index: 5;
  background: transparent;
}
.bpf-col-handle:hover, .bpf-col-handle.is-dragging {
  background: rgba(37, 99, 235, 0.35);
}
.bpf-edge-handle-right {
  position: absolute;
  top: 0;
  right: -4px;
  width: 8px;
  cursor: ew-resize;
  z-index: 7;
  background: transparent;
}
.bpf-edge-handle-bottom {
  position: absolute;
  left: 0;
  bottom: -4px;
  height: 8px;
  cursor: ns-resize;
  z-index: 7;
  background: transparent;
}
.bpf-edge-handle-right:hover,
.bpf-edge-handle-bottom:hover,
.bpf-edge-handle-right.is-dragging,
.bpf-edge-handle-bottom.is-dragging {
  background: rgba(37, 99, 235, 0.4);
}
.bpf-table-hint {
  font-size: 11px;
  color: #6b7280;
  margin: 4px 0 6px;
}
`;

			const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><style>${editorCss}</style></head>
<body>${rendered.htmlDocument.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? rendered.bodyHtml}
</body></html>`;

			if (!this.frameEl) return;
			this.frameEl.srcdoc = html;
			await new Promise<void>((resolve) => {
				if (!this.frameEl) {
					resolve();
					return;
				}
				this.frameEl.onload = () => resolve();
			});

			this.wireTables();
			const n = this.doc()?.querySelectorAll("table").length ?? 0;
			this.setStatus(
				n === 0
					? "No tables in this note"
					: `${n} table${n === 1 ? "" : "s"} · click cells · drag column edges`,
			);
		} catch (err) {
			console.error(err);
			this.setStatus("Failed to load");
			new Notice(`Table adjust failed: ${String(err)}`);
		}
	}

	private teardownHandlers(): void {
		for (const fn of this.detachFns) fn();
		this.detachFns = [];
	}

	private wireTables(): void {
		this.teardownHandlers();
		this.selected.clear();
		this.dragSelect = null;
		const doc = this.doc();
		const root = this.root();
		if (!doc || !root) return;

		const onDocMouseUp = () => {
			this.dragSelect = null;
			this.resizing = false;
		};
		doc.addEventListener("mouseup", onDocMouseUp);
		this.detachFns.push(() => doc.removeEventListener("mouseup", onDocMouseUp));

		const onDocMouseMove = (ev: MouseEvent) => {
			if (!this.dragSelect || this.resizing) return;
			const cell = (ev.target as HTMLElement | null)?.closest?.(
				"td, th",
			) as HTMLTableCellElement | null;
			if (!cell) return;
			const table = cell.closest("table") as HTMLTableElement | null;
			if (!table) return;
			const tables = Array.from(root.querySelectorAll("table")) as HTMLTableElement[];
			const tableIndex = tables.indexOf(table);
			if (tableIndex !== this.dragSelect.tableIndex) return;
			const row = cell.parentElement as HTMLTableRowElement;
			this.selectRect(
				tableIndex,
				this.dragSelect.startRow,
				this.dragSelect.startCol,
				row.rowIndex,
				cell.cellIndex,
			);
		};
		doc.addEventListener("mousemove", onDocMouseMove);
		this.detachFns.push(() =>
			doc.removeEventListener("mousemove", onDocMouseMove),
		);

		const onBackgroundDown = (ev: MouseEvent) => {
			const t = ev.target as HTMLElement | null;
			if (!t) return;
			if (t.closest?.("td, th, .bpf-col-handle, .bpf-edge-handle-right, .bpf-edge-handle-bottom, button")) {
				return;
			}
			this.clearSelection();
		};
		doc.addEventListener("mousedown", onBackgroundDown);
		this.detachFns.push(() =>
			doc.removeEventListener("mousedown", onBackgroundDown),
		);

		const tables = Array.from(root.querySelectorAll("table")) as HTMLTableElement[];
		tables.forEach((table, tableIndex) => {
			const hint = doc.createElement("div");
			hint.className = "bpf-table-hint";
			hint.textContent = `Table ${tableIndex + 1}`;
			table.parentElement?.insertBefore(hint, table);

			const onCellDown = (ev: MouseEvent) => {
				if (this.resizing) return;
				const cell = (ev.target as HTMLElement | null)?.closest?.(
					"td, th",
				) as HTMLTableCellElement | null;
				if (!cell || !table.contains(cell)) return;
				if ((ev.target as HTMLElement).closest?.(
					".bpf-col-handle, .bpf-edge-handle-right, .bpf-edge-handle-bottom",
				)) {
					return;
				}
				ev.preventDefault();
				this.activeTableIndex = tableIndex;
				const row = cell.parentElement as HTMLTableRowElement;
				this.dragSelect = {
					tableIndex,
					startRow: row.rowIndex,
					startCol: cell.cellIndex,
				};
				this.selectRect(
					tableIndex,
					row.rowIndex,
					cell.cellIndex,
					row.rowIndex,
					cell.cellIndex,
				);
			};
			table.addEventListener("mousedown", onCellDown);
			this.detachFns.push(() =>
				table.removeEventListener("mousedown", onCellDown),
			);

			this.installResizeHandles(table, tableIndex);
		});
	}

	private clearSelection(): void {
		this.selected.clear();
		this.paintSelection();
		this.setStatus("Selection cleared");
	}

	private selectRect(
		tableIndex: number,
		r0: number,
		c0: number,
		r1: number,
		c1: number,
	): void {
		const rowMin = Math.min(r0, r1);
		const rowMax = Math.max(r0, r1);
		const colMin = Math.min(c0, c1);
		const colMax = Math.max(c0, c1);
		this.selected.clear();
		for (let r = rowMin; r <= rowMax; r++) {
			for (let c = colMin; c <= colMax; c++) {
				this.selected.add(`${tableIndex}:${r}:${c}`);
			}
		}
		this.activeTableIndex = tableIndex;
		this.paintSelection();
		this.setStatus(
			`Table ${tableIndex + 1} · ${this.selected.size} cell(s) selected`,
		);
	}

	private paintSelection(): void {
		const root = this.root();
		if (!root) return;
		root.querySelectorAll(".bpf-cell-selected").forEach((el) => {
			el.classList.remove("bpf-cell-selected");
		});
		const tables = Array.from(root.querySelectorAll("table")) as HTMLTableElement[];
		for (const key of this.selected) {
			const [ti, ri, ci] = key.split(":").map(Number);
			const table = tables[ti];
			const cell = table?.rows[ri]?.cells[ci];
			cell?.classList.add("bpf-cell-selected");
		}
	}

	private ensureWrap(table: HTMLTableElement): HTMLElement {
		const parent = table.parentElement;
		if (parent?.classList.contains("bpf-table-wrap")) return parent;
		const doc = this.doc();
		if (!doc || !parent) return table;
		const wrap = doc.createElement("div");
		wrap.className = "bpf-table-wrap";
		parent.insertBefore(wrap, table);
		wrap.appendChild(table);
		return wrap;
	}

	private clearHandles(table: HTMLTableElement): void {
		const wrap = table.parentElement?.classList.contains("bpf-table-wrap")
			? table.parentElement
			: table;
		wrap
			.querySelectorAll(
				".bpf-col-handle, .bpf-edge-handle-right, .bpf-edge-handle-bottom",
			)
			.forEach((h) => h.remove());
	}

	private repositionColHandles(table: HTMLTableElement): void {
		const wrap = table.parentElement?.classList.contains("bpf-table-wrap")
			? table.parentElement
			: table;
		const wrapLeft = wrap.getBoundingClientRect().left;
		const tableTop = table.getBoundingClientRect().top;
		const wrapTop = wrap.getBoundingClientRect().top;
		const tableH = table.getBoundingClientRect().height;
		wrap.querySelectorAll(".bpf-col-handle").forEach((h) => {
			const col = Number((h as HTMLElement).dataset.col);
			const c = table.rows[0]?.cells[col];
			if (!c) return;
			const el = h as HTMLElement;
			el.style.left = `${c.getBoundingClientRect().right - wrapLeft}px`;
			el.style.top = `${tableTop - wrapTop}px`;
			el.style.height = `${tableH}px`;
		});
		const right = wrap.querySelector(".bpf-edge-handle-right") as HTMLElement | null;
		if (right) {
			right.style.top = `${tableTop - wrapTop}px`;
			right.style.height = `${tableH}px`;
		}
		const bottom = wrap.querySelector(
			".bpf-edge-handle-bottom",
		) as HTMLElement | null;
		if (bottom) {
			bottom.style.width = `${table.getBoundingClientRect().width}px`;
		}
	}

	private installResizeHandles(table: HTMLTableElement, tableIndex: number): void {
		const doc = this.doc();
		if (!doc) return;

		const wrap = this.ensureWrap(table);
		this.clearHandles(table);
		const n = tableColumnCount(table);
		const wrapLeft = wrap.getBoundingClientRect().left;
		const wrapTop = wrap.getBoundingClientRect().top;
		const tableRect = table.getBoundingClientRect();

		// Inner borders: redistribute adjacent columns; keep overall width
		for (let i = 0; i < n - 1; i++) {
			const cell = table.rows[0]?.cells[i];
			if (!cell) continue;
			const cr = cell.getBoundingClientRect();
			const handle = doc.createElement("div");
			handle.className = "bpf-col-handle";
			handle.style.left = `${cr.right - wrapLeft}px`;
			handle.style.top = `${tableRect.top - wrapTop}px`;
			handle.style.height = `${tableRect.height}px`;
			handle.dataset.col = String(i);
			wrap.appendChild(handle);

			const onDown = (ev: MouseEvent) => {
				ev.preventDefault();
				ev.stopPropagation();
				this.resizing = true;
				this.dragSelect = null;
				this.activeTableIndex = tableIndex;
				handle.classList.add("is-dragging");
				lockTablePixelWidth(table);
				markTableTouched(table);
				const startPct = measureColWidthsPct(table);
				applyColWidthsPct(table, startPct);
				const startX = ev.clientX;
				const left = i;
				const right = i + 1;

				const onMove = (mv: MouseEvent) => {
					const tableW = Math.max(1, table.getBoundingClientRect().width);
					const dxPct = ((mv.clientX - startX) / tableW) * 100;
					const next = startPct.slice();
					const min = 6;
					let a = startPct[left] + dxPct;
					let b = startPct[right] - dxPct;
					if (a < min) {
						b -= min - a;
						a = min;
					}
					if (b < min) {
						a -= min - b;
						b = min;
					}
					next[left] = a;
					next[right] = b;
					applyColWidthsPct(table, normalizePercents(next));
					this.repositionColHandles(table);
				};

				const onUp = () => {
					handle.classList.remove("is-dragging");
					this.resizing = false;
					doc.removeEventListener("mousemove", onMove);
					doc.removeEventListener("mouseup", onUp);
					this.setStatus(`Table ${tableIndex + 1} · columns updated`);
				};

				doc.addEventListener("mousemove", onMove);
				doc.addEventListener("mouseup", onUp);
			};

			handle.addEventListener("mousedown", onDown);
			this.detachFns.push(() => handle.removeEventListener("mousedown", onDown));
		}

		// Right edge: overall table width
		const rightEdge = doc.createElement("div");
		rightEdge.className = "bpf-edge-handle-right";
		rightEdge.title = "Drag to resize table width";
		rightEdge.style.top = `${tableRect.top - wrapTop}px`;
		rightEdge.style.height = `${tableRect.height}px`;
		wrap.appendChild(rightEdge);
		{
			const onDown = (ev: MouseEvent) => {
				ev.preventDefault();
				ev.stopPropagation();
				this.resizing = true;
				this.dragSelect = null;
				this.activeTableIndex = tableIndex;
				rightEdge.classList.add("is-dragging");
				const pct = measureColWidthsPct(table);
				applyColWidthsPct(table, pct);
				markTableTouched(table);
				const startW = table.getBoundingClientRect().width;
				const startX = ev.clientX;
				const parentW =
					layoutParentWidth(table) || startW * 2;
				const maxW = Math.max(80, parentW);

				const onMove = (mv: MouseEvent) => {
					const newW = Math.min(
						maxW,
						Math.max(80, startW + (mv.clientX - startX)),
					);
					setTablePixelWidth(table, newW);
					this.repositionColHandles(table);
				};

				const onUp = () => {
					rightEdge.classList.remove("is-dragging");
					this.resizing = false;
					doc.removeEventListener("mousemove", onMove);
					doc.removeEventListener("mouseup", onUp);
					this.setStatus(
						`Table ${tableIndex + 1} · width ${Math.round(
							table.getBoundingClientRect().width,
						)}px`,
					);
				};

				doc.addEventListener("mousemove", onMove);
				doc.addEventListener("mouseup", onUp);
			};
			rightEdge.addEventListener("mousedown", onDown);
			this.detachFns.push(() => rightEdge.removeEventListener("mousedown", onDown));
		}

		// Bottom edge: overall table height
		const bottomEdge = doc.createElement("div");
		bottomEdge.className = "bpf-edge-handle-bottom";
		bottomEdge.title = "Drag to resize table height";
		bottomEdge.style.width = `${tableRect.width}px`;
		wrap.appendChild(bottomEdge);
		{
			const onDown = (ev: MouseEvent) => {
				ev.preventDefault();
				ev.stopPropagation();
				this.resizing = true;
				this.dragSelect = null;
				this.activeTableIndex = tableIndex;
				bottomEdge.classList.add("is-dragging");
				markTableTouched(table);
				const startH = table.getBoundingClientRect().height;
				const startY = ev.clientY;
				const rowCount = Math.max(1, table.rows.length);
				const startRowHeights = Array.from(table.rows).map((r) =>
					r.getBoundingClientRect().height,
				);

				const onMove = (mv: MouseEvent) => {
					const newH = Math.max(32, startH + (mv.clientY - startY));
					setTablePixelHeight(table, newH);
					const scale = newH / Math.max(1, startH);
					for (let ri = 0; ri < rowCount; ri++) {
						const row = table.rows[ri];
						if (!row) continue;
						row.style.height = `${Math.max(16, Math.round(startRowHeights[ri] * scale))}px`;
					}
					this.repositionColHandles(table);
				};

				const onUp = () => {
					bottomEdge.classList.remove("is-dragging");
					this.resizing = false;
					doc.removeEventListener("mousemove", onMove);
					doc.removeEventListener("mouseup", onUp);
					this.setStatus(
						`Table ${tableIndex + 1} · height ${Math.round(
							table.getBoundingClientRect().height,
						)}px`,
					);
				};

				doc.addEventListener("mousemove", onMove);
				doc.addEventListener("mouseup", onUp);
			};
			bottomEdge.addEventListener("mousedown", onDown);
			this.detachFns.push(() =>
				bottomEdge.removeEventListener("mousedown", onDown),
			);
		}
	}

	private selectedInActiveTable(): {
		table: HTMLTableElement;
		cols: Set<number>;
		rows: Set<number>;
	} | null {
		const root = this.root();
		if (!root) return null;
		const tables = Array.from(root.querySelectorAll("table")) as HTMLTableElement[];
		const table = tables[this.activeTableIndex];
		if (!table) return null;
		const cols = new Set<number>();
		const rows = new Set<number>();
		for (const key of this.selected) {
			const [ti, ri, ci] = key.split(":").map(Number);
			if (ti !== this.activeTableIndex) continue;
			rows.add(ri);
			cols.add(ci);
		}
		return { table, cols, rows };
	}

	private equalizeSelectedColumns(): void {
		const ctx = this.selectedInActiveTable();
		if (!ctx || ctx.cols.size < 2) {
			new Notice("Select two or more cells in different columns first.");
			return;
		}
		const { table, cols } = ctx;
		markTableTouched(table);
		const pct = measureColWidthsPct(table);
		const indices = Array.from(cols).sort((a, b) => a - b);
		const avg =
			indices.reduce((s, i) => s + (pct[i] ?? 0), 0) / Math.max(1, indices.length);
		for (const i of indices) pct[i] = avg;
		applyColWidthsPct(table, normalizePercents(pct));
		this.reinstallHandlesForActive();
		this.setStatus(`Table ${this.activeTableIndex + 1} · column widths equalized`);
	}

	private equalizeSelectedRows(): void {
		const ctx = this.selectedInActiveTable();
		if (!ctx || ctx.rows.size < 2) {
			new Notice("Select two or more cells in different rows first.");
			return;
		}
		const { table, rows } = ctx;
		markTableTouched(table);
		const indices = Array.from(rows).sort((a, b) => a - b);
		let maxH = 0;
		for (const i of indices) {
			const row = table.rows[i];
			if (!row) continue;
			maxH = Math.max(maxH, row.getBoundingClientRect().height);
		}
		for (const i of indices) {
			const row = table.rows[i];
			if (row) row.style.height = `${Math.round(maxH)}px`;
		}
		this.setStatus(`Table ${this.activeTableIndex + 1} · row heights equalized`);
	}

	private reinstallHandlesForActive(): void {
		const root = this.root();
		if (!root) return;
		const tables = Array.from(root.querySelectorAll("table")) as HTMLTableElement[];
		const table = tables[this.activeTableIndex];
		if (!table) return;
		this.clearHandles(table);
		this.installResizeHandles(table, this.activeTableIndex);
	}

	private resetActiveTable(): void {
		const root = this.root();
		if (!root) return;
		const tables = Array.from(root.querySelectorAll("table")) as HTMLTableElement[];
		const table = tables[this.activeTableIndex];
		if (!table) return;
		resetTableSizing(table);
		this.clearHandles(table);
		this.installResizeHandles(table, this.activeTableIndex);
		this.setStatus(`Table ${this.activeTableIndex + 1} · reset`);
	}

	private clearAllSizing(): void {
		const root = this.root();
		if (!root) return;
		const tables = Array.from(root.querySelectorAll("table")) as HTMLTableElement[];
		tables.forEach((table, i) => {
			resetTableSizing(table);
			this.clearHandles(table);
			this.installResizeHandles(table, i);
		});
		if (this.plugin.settings.tableLayouts) {
			delete this.plugin.settings.tableLayouts[this.file.path];
		}
		void this.plugin.saveSettings();
		this.setStatus("All table sizing cleared");
	}

	private async applyAndClose(): Promise<void> {
		const root = this.root();
		if (!root) return;
		// Snapshot from a clean DOM (no handles/wrappers), then restore is unnecessary — we close.
		stripEditorChrome(root);
		const layouts = captureNoteTableLayouts(root);
		if (!this.plugin.settings.tableLayouts) {
			this.plugin.settings.tableLayouts = {};
		}
		if (layouts.tables.length === 0) {
			delete this.plugin.settings.tableLayouts[this.file.path];
		} else {
			// Deep clone so preview gets a stable object even if settings mutate later
			this.plugin.settings.tableLayouts[this.file.path] = JSON.parse(
				JSON.stringify(layouts),
			) as NoteTableLayouts;
		}
		await this.plugin.saveSettings();
		const saved =
			this.plugin.settings.tableLayouts[this.file.path] ??
			({ tables: [] } as NoteTableLayouts);
		this.close();
		this.onApplied(saved);
		new Notice(
			saved.tables.length
				? `Saved layout for ${saved.tables.length} table(s)`
				: "No custom table sizing to save",
		);
	}
}

function layoutParentWidth(table: HTMLTableElement): number {
	const parent =
		(table.closest(".markdown-preview-view") as HTMLElement | null) ??
		table.parentElement;
	if (!parent) return 0;
	return parent.clientWidth || parent.getBoundingClientRect().width;
}

/** Apply saved layouts for a path (helper for export/preview). */
export function layoutsForFile(
	plugin: BeautifulPdfPlugin,
	file: TFile,
): NoteTableLayouts | null {
	return plugin.settings.tableLayouts?.[file.path] ?? null;
}
