import { type AppError, fail, isAppError } from "../errors"
import { type RawRecord, recordsOf } from "./import-parse"

/**
 * The one CSV template `tx import` reads, in order (ADR-0025). The header is a wire contract:
 * `--template` prints it, the reader requires it, and the command's `file` description names it.
 */
export const IMPORT_COLUMNS = [
	"date",
	"from",
	"to",
	"amount",
	"memo",
	"external_ref",
	"project",
] as const

export type ImportColumn = (typeof IMPORT_COLUMNS)[number]

/** The header as one line; the only definition of the template's text. */
export const IMPORT_HEADER: string = IMPORT_COLUMNS.join(",")

/** One data row: the physical line it starts on, and its seven cells by column name. */
export type ImportRow = { line: number } & Record<ImportColumn, string>

function templateHint(): string {
	return 'Run "traj tx import --template" to print the template.'
}

function headerMismatch(actual: readonly string[]): AppError {
	const found = actual.join(",")
	return fail("invalid_input", {
		path: "header",
		message: `header: expected "${IMPORT_HEADER}", found "${found}"`,
		hint: templateHint(),
		details: { expected: IMPORT_HEADER, actual: found },
	})
}

function wrongWidth(line: number, found: number): AppError {
	return fail("invalid_input", {
		path: `line.${line}`,
		message: `line.${line}: expected ${IMPORT_COLUMNS.length} fields, found ${found}`,
		details: { expected: IMPORT_COLUMNS.length, actual: found },
	})
}

function rowOf(record: RawRecord): ImportRow {
	const [date = "", from = "", to = "", amount = "", memo = "", external_ref = "", project = ""] =
		record.fields
	return { line: record.line, date, from, to, amount, memo, external_ref, project }
}

/**
 * The template's rows in file order, or one file-level `invalid_input`: an empty file, a wrong
 * header, or a malformed row. A header-only file is a successful no-op with no rows.
 */
export function readImportCsv(text: string): ImportRow[] | AppError {
	const records = recordsOf(text)
	const first = records.next()
	if (first.done) {
		return fail("invalid_input", {
			path: "file",
			message: "file: the CSV is empty; it needs the template header",
			hint: templateHint(),
		})
	}
	const header = first.value
	if (isAppError(header)) return header
	// A quoted header cell is compared after trimming, so a spreadsheet's quoting is harmless.
	const actual = header.fields.map((cell) => cell.trim())
	if (actual.length !== IMPORT_COLUMNS.length) return headerMismatch(actual)
	if (actual.some((cell, at) => cell !== IMPORT_COLUMNS[at])) return headerMismatch(actual)
	const rows: ImportRow[] = []
	for (const record of records) {
		if (isAppError(record)) return record
		if (record.fields.length !== IMPORT_COLUMNS.length) {
			return wrongWidth(record.line, record.fields.length)
		}
		rows.push(rowOf(record))
	}
	return rows
}
