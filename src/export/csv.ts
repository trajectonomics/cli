import { DUMP_TABLES, type DumpRows, type DumpTable } from "../dump/view"
import { FIELDS } from "../interchange/format"
import { plain } from "../table/escape"
import type { ExportFile } from "./files"

/** The UTF-8 byte order mark, so a spreadsheet reads Thai text as UTF-8 instead of mojibake. */
const BOM = "\uFEFF"

/** RFC 4180: quote a cell that holds a comma, a quote or a line break, and double its quotes. */
function quoted(value: string): string {
	return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

/** One table's CSV: the header, then one `\r\n`-terminated line per row. Empty is header only. */
export function csvText(table: DumpTable, rows: readonly Record<string, unknown>[]): string {
	const keys = Object.keys(FIELDS[table])
	const line = (values: readonly string[]) => `${values.map(quoted).join(",")}\r\n`
	const lines = [line(keys)]
	for (const row of rows) lines.push(line(keys.map((key) => plain(row[key]))))
	return `${BOM}${lines.join("")}`
}

/** One file per table, named for the table, in record order. CSV is a human copy, not a restore. */
export function csvFiles(rows: DumpRows): readonly ExportFile[] {
	return DUMP_TABLES.map((table) => ({
		name: `${table}.csv`,
		contents: csvText(table, rows[table]),
	}))
}
