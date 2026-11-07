import { type AppError, isAppError } from "../errors"
import type { RestoreCounts, Store } from "../store"
import { addRow, checkRecord, type Decoded, decodeRecord, emptyRows, identityOf } from "./decode"
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

/** Refuses a record whose identity an earlier line already used. */
function repeated(decoded: Decoded, seen: Map<string, number>, line: number): AppError | null {
	const { key, field } = identityOf(decoded)
	const firstLine = seen.get(key)
	if (firstLine === undefined) {
		seen.set(key, line)
		return null
	}
	const reason = `repeats the ${decoded.type} ${field} of line ${firstLine}`
	return invalid(`line.${line}.${field}`, reason, { firstLine })
}

function decodeAll(lines: readonly string[], entityId: string) {
	const rows = emptyRows()
	const seen = new Map<string, number>()
	for (const [index, text] of lines.entries()) {
		const line = index + 2
		const path = `line.${line}`
		const record = parseLine(text, path)
		if (isAppError(record)) return record
		const decoded = decodeRecord(record, path)
		if (isAppError(decoded)) return decoded
		const broken = checkRecord(decoded, entityId, path) ?? repeated(decoded, seen, line)
		if (broken) return broken
		addRow(rows, decoded)
	}
	if (rows.entity.length === 0) {
		return invalid("entity", "the file must hold exactly one entity record, the personal entity")
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
