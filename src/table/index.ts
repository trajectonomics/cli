import { type ColumnHint, isRecord, tableLines } from "./lines"

export type { ColumnHint } from "./lines"

/** Columns whose values read best right-aligned: ids' counts and amounts. */
export const RIGHT_ALIGNED: ReadonlySet<string> = new Set(["version", "ordinal", "amount"])

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
	/**
	 * A result field holding plain sentences, printed after the tables, one per line. It is for a
	 * fact a person must read (such as a status only the JSON would otherwise show), never a
	 * layout choice.
	 */
	note?: string
	/**
	 * Further row fields to render as their own table after `tables`, so a result keeps one shape
	 * in JSON while a person reads every row. A field that is absent or empty renders nothing.
	 */
	extra?: readonly ExtraTable[]
}

/** One further row field a hint renders as a table of its own. */
export type ExtraTable = {
	/** The result field holding the rows. */
	field: string
	/** The block's heading, printed with its row count. */
	name: string
	columns: readonly ColumnHint[]
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
	const notes = noteLines(data, hint)
	const tables = [...blocks, ...extraBlocks(data, hint)].join("\n\n")
	return notes.length === 0 ? tables : `${tables}\n\n${notes.join("\n")}`
}

/** The tables a hint asks for beyond its main one; an absent or empty field renders nothing. */
function extraBlocks(data: Record<string, unknown>, hint: RenderHint): string[] {
	const blocks: string[] = []
	for (const extra of hint.extra ?? []) {
		const rows = data[extra.field]
		if (!Array.isArray(rows) || rows.length === 0) continue
		blocks.push(tableLines(extra.name, rows.length, rows, extra.columns))
	}
	return blocks
}

/** The hint's note field, one sentence per line; a result without one prints nothing extra. */
function noteLines(data: Record<string, unknown>, hint: RenderHint): string[] {
	if (hint.note === undefined) return []
	const lines = data[hint.note]
	if (!Array.isArray(lines)) return []
	return lines.filter((line): line is string => typeof line === "string")
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
