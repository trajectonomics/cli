import { cell } from "./escape"

/** One column of a table-shaped Result: its row key, its heading, and how it is padded. */
export type ColumnHint = {
	key: string
	label: string
	align?: "left" | "right"
}

/**
 * How a table-shaped Result renders in the human Format. It is a hint, not a second result
 * shape: the output schema stays the contract, and JSON ignores it.
 */
export type RenderHint = {
	/** The result field holding the table entries, each with a `name` and a `count`. */
	tables: string
	/** The entry field holding one table's rows. */
	rows: string
	/** One table's columns, keyed by the entry's `name`. */
	columns: Readonly<Record<string, readonly ColumnHint[]>>
}

type Cells = readonly (readonly string[])[]

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function cellsOf(row: unknown, columns: readonly ColumnHint[]): readonly string[] {
	const record = isRecord(row) ? row : {}
	return columns.map((column) => cell(record[column.key]))
}

function padded(value: string, width: number, align: ColumnHint["align"]): string {
	const padding = " ".repeat(Math.max(width - Bun.stringWidth(value), 0))
	return align === "right" ? `${padding}${value}` : `${value}${padding}`
}

// Bun.stringWidth counts display columns, so Thai combining marks do not skew the padding.
function widthsOf(columns: readonly ColumnHint[], cells: Cells): readonly number[] {
	return columns.map((column, index) =>
		Math.max(
			Bun.stringWidth(column.label),
			...cells.map((row) => Bun.stringWidth(row[index] ?? "")),
		),
	)
}

function line(
	values: readonly string[],
	columns: readonly ColumnHint[],
	widths: readonly number[],
): string {
	const paddedCells = values.map((value, index) =>
		padded(value, widths[index] ?? 0, columns[index]?.align ?? "left"),
	)
	return paddedCells.join("  ").trimEnd()
}

function tableLines(
	name: string,
	count: number,
	rows: readonly unknown[],
	columns: readonly ColumnHint[],
): string {
	const cells = rows.map((row) => cellsOf(row, columns))
	const widths = widthsOf(columns, cells)
	const heading = `${name} (${count} ${count === 1 ? "row" : "rows"})`
	const header = line(
		columns.map((column) => column.label),
		columns,
		widths,
	)
	return [heading, header, ...cells.map((row) => line(row, columns, widths))].join("\n")
}

/**
 * The table view a hint asks for, or null when the result does not fit it: a bare summary has
 * no rows, so it falls back to the generic renderer.
 */
export function renderTableResult(data: unknown, hint: RenderHint): string | null {
	if (!isRecord(data)) return null
	const entries = data[hint.tables]
	if (!Array.isArray(entries) || entries.length === 0) return null
	const blocks: string[] = []
	for (const entry of entries) {
		const block = entry === null || !isRecord(entry) ? null : blockOf(entry, hint)
		if (block === null) return null
		blocks.push(block)
	}
	return blocks.join("\n\n")
}

function blockOf(entry: Record<string, unknown>, hint: RenderHint): string | null {
	const name = entry["name"]
	const count = entry["count"]
	const rows = entry[hint.rows]
	const columns = typeof name === "string" ? hint.columns[name] : undefined
	if (typeof name !== "string" || typeof count !== "number") return null
	if (!Array.isArray(rows) || columns === undefined) return null
	return tableLines(name, count, rows, columns)
}
