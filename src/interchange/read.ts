import { type AppError, isAppError } from "../errors"
import type { RestoreCounts, Store } from "../store"
import { addRow, checkRecord, decodeRecord, emptyRows } from "./decode"
import { FORMAT_VERSION } from "./format"
import { exactKeys, invalid, parseLine } from "./invalid"

/** Rows restored per record type, the seeded personal entity included. */
export type ImportCounts = RestoreCounts

const HEADER_KEYS = ["record", "formatVersion", "schemaVersion"]

function checkHeader(line: string, schemaVersion: number): AppError | null {
	const path = "line.1"
	const header = parseLine(line, path)
	if (isAppError(header)) return header
	if (header["record"] !== "header") return invalid(`${path}.record`, 'must be "header"')
	const wrongKeys = exactKeys(header, HEADER_KEYS, path)
	if (wrongKeys) return wrongKeys
	const known = { formatVersion: FORMAT_VERSION, schemaVersion }
	for (const [key, expected] of Object.entries(known)) {
		if (header[key] !== expected) {
			const reason = `${JSON.stringify(header[key])} is not a version this build reads (${expected})`
			return invalid(`${path}.${key}`, reason, { expected, actual: header[key] })
		}
	}
	return null
}

function linesOf(text: string): string[] {
	return (text.endsWith("\n") ? text.slice(0, -1) : text).split("\n")
}

function decodeAll(lines: readonly string[], entityId: string) {
	const rows = emptyRows()
	for (const [index, line] of lines.entries()) {
		const path = `line.${index + 2}`
		const record = parseLine(line, path)
		if (isAppError(record)) return record
		const decoded = decodeRecord(record, path)
		if (isAppError(decoded)) return decoded
		const broken = checkRecord(decoded, entityId, path)
		if (broken) return broken
		addRow(rows, decoded)
	}
	return rows
}

/**
 * Restores a canonical JSONL export into `store`, which must hold only the seeded personal
 * entity. The header and every record are checked before any row is written; the rows are then
 * written verbatim in one transaction, so a failure anywhere leaves the database unchanged.
 */
export function importJsonl(text: string, store: Store): ImportCounts | AppError {
	const schemaVersion = store.schemaVersion()
	if (isAppError(schemaVersion)) return schemaVersion
	const [header = "", ...records] = linesOf(text)
	const badHeader = checkHeader(header, schemaVersion)
	if (badHeader) return badHeader
	const rows = decodeAll(records, store.entityId)
	return isAppError(rows) ? rows : store.restore(rows)
}
