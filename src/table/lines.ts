import { cell } from "./escape"

/** One column of a table-shaped Result: its row key, its heading, and how it is padded. */
export type ColumnHint = {
	key: string
	label: string
	align?: "left" | "right"
}

type Cells = readonly (readonly string[])[]

export function isRecord(value: unknown): value is Record<string, unknown> {
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

export function tableLines(
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
