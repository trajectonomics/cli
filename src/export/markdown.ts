import { DUMP_TABLES, type DumpRows, type DumpTable } from "../dump/view"
import { FIELDS } from "../interchange/format"
import { RIGHT_ALIGNED } from "../table"
import { plain } from "../table/escape"
import type { ExportFile } from "./files"

/**
 * The only HTML a cell may hold: a line break, and the entities its own characters became. A
 * backslash, a pipe, `<`, `>` and `&` are escaped so a memo cannot break the table or inject
 * markup; one pass, so `&lt;` from `<` is never escaped twice.
 */
const ESCAPES: Readonly<Record<string, string>> = {
	"\\": "\\\\",
	"|": "\\|",
	"<": "&lt;",
	">": "&gt;",
	"&": "&amp;",
	"\n": "<br>",
}

export function markdownCell(value: unknown): string {
	const text = plain(value).replaceAll("\r\n", "\n").replaceAll("\r", "\n")
	return [...text].map((char) => ESCAPES[char] ?? char).join("")
}

function section(table: DumpTable, rows: readonly Record<string, unknown>[]): string {
	const keys = Object.keys(FIELDS[table])
	const row = (values: readonly string[]) => `| ${values.join(" | ")} |`
	const align = keys.map((key) => (RIGHT_ALIGNED.has(key) ? "---:" : "---"))
	const heading = `## ${table} (${rows.length} ${rows.length === 1 ? "row" : "rows"})`
	const lines = [heading, "", row(keys), row(align)]
	for (const cells of rows) lines.push(row(keys.map((key) => markdownCell(cells[key]))))
	return lines.join("\n")
}

/** One document, one section per table in record order: a heading with the count, then a table. */
export function markdownText(rows: DumpRows): string {
	return `${DUMP_TABLES.map((table) => section(table, rows[table])).join("\n\n")}\n`
}

export function markdownFile(rows: DumpRows): ExportFile {
	return { name: "traj.md", contents: markdownText(rows) }
}
