import { viewDump } from "../dump/view"
import type { AppError } from "../errors"
import { isAppError } from "../errors"
import type { Store } from "../store"
import { FIELDS, FORMAT_VERSION, RECORD_ORDER, type RecordType } from "./format"

function encode(type: RecordType, row: Record<string, unknown>): string {
	const members = Object.entries(FIELDS[type]).map(([key, kind]) => {
		// Stored canonical text is already the JCS serialisation of the document object.
		if (kind === "document") return `"${key}":${row[key] as string}`
		return `"${key}":${JSON.stringify(row[key])}`
	})
	return `{"record":${JSON.stringify(type)},${members.join(",")}}`
}

/**
 * The canonical JSONL dump of `store`: a header, then one line per row in the fixed type order,
 * tombstones included and every column verbatim. Reads no clock, so two exports of the same
 * database are byte-identical. Every line, the last included, ends in `\n`.
 */
export function exportJsonl(store: Store): string | AppError {
	const schemaVersion = store.schemaVersion()
	if (isAppError(schemaVersion)) return schemaVersion
	const rows = store.dump()
	if (isAppError(rows)) return rows
	const view = viewDump(rows)
	const header = JSON.stringify({ record: "header", formatVersion: FORMAT_VERSION, schemaVersion })
	const lines = [header]
	for (const type of RECORD_ORDER) {
		for (const row of view[type]) {
			lines.push(encode(type, row as Record<string, unknown>))
		}
	}
	return `${lines.join("\n")}\n`
}
