import type { AppError } from "../errors"
import { isAppError } from "../errors"
import { formatMinorUnits, type Store } from "../store"
import { FIELDS, FORMAT_VERSION, RECORD_ORDER, type RecordRows, type RecordType } from "./format"

type Rows = { [T in RecordType]: RecordRows[T][] }

function encode(type: RecordType, row: Record<string, unknown>): string {
	const members = Object.entries(FIELDS[type]).map(([key, kind]) => {
		const value = row[key]
		// Stored canonical text is already the JCS serialisation of the document object.
		if (kind === "document") return `"${key}":${value as string}`
		if (kind === "amount") {
			const amount = formatMinorUnits(value as number, row["currency"] as string)
			return `"${key}":${JSON.stringify(amount)}`
		}
		return `"${key}":${JSON.stringify(value)}`
	})
	return `{"record":${JSON.stringify(type)},${members.join(",")}}`
}

function readAll(store: Store): Rows | AppError {
	const lists = {
		entity: store.listEntities({ sort: "id", includeDeleted: true }),
		account: store.listAccounts({ sort: "id", includeDeleted: true }),
		tx: store.listTransactions({ sort: "date" }),
		posting: store.listPostings({ sort: "tx_id" }),
		scenario: store.listScenarios({ sort: "id", includeDeleted: true }),
	}
	for (const list of Object.values(lists)) if (isAppError(list)) return list
	return lists as Rows
}

/**
 * The canonical JSONL dump of `store`: a header, then one line per row in the fixed type order,
 * tombstones included and every column verbatim. Reads no clock, so two exports of the same
 * database are byte-identical. Every line, the last included, ends in `\n`.
 */
export function exportJsonl(store: Store): string | AppError {
	const schemaVersion = store.schemaVersion()
	if (isAppError(schemaVersion)) return schemaVersion
	const rows = readAll(store)
	if (isAppError(rows)) return rows
	const header = JSON.stringify({ record: "header", formatVersion: FORMAT_VERSION, schemaVersion })
	const lines = [header]
	for (const type of RECORD_ORDER) {
		for (const row of rows[type]) lines.push(encode(type, row as Record<string, unknown>))
	}
	return `${lines.join("\n")}\n`
}
