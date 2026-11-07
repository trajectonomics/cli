import { type AppError, isAppError } from "../errors"
import { ACCOUNT_TYPES, contentHash, isAccountType, type RestoreRows } from "../store"
import { DECODERS } from "./fields"
import { FIELDS, RECORD_ORDER, type RecordRows, type RecordType } from "./format"
import { exactKeys, invalid } from "./invalid"

export type Decoded = { [T in RecordType]: { type: T; row: RecordRows[T] } }[RecordType]
type Rows = { [T in RecordType]: RecordRows[T][] }

function recordType(record: Record<string, unknown>, path: string): RecordType | AppError {
	const type = record["record"]
	if (RECORD_ORDER.includes(type as RecordType)) return type as RecordType
	return invalid(`${path}.record`, `must be one of ${RECORD_ORDER.join(", ")}`)
}

/** Checks each field against its declared kind and builds the store row from it. */
export function decodeRecord(record: Record<string, unknown>, path: string): Decoded | AppError {
	const type = recordType(record, path)
	if (isAppError(type)) return type
	const fields = Object.entries(FIELDS[type])
	const wrongKeys = exactKeys(record, ["record", ...fields.map(([key]) => key)], path)
	if (wrongKeys) return wrongKeys
	const row: Record<string, unknown> = {}
	for (const [key, kind] of fields) {
		const value = DECODERS[kind](record[key], `${path}.${key}`, record)
		if (isAppError(value)) return value
		row[key] = value
	}
	return { type, row } as Decoded
}

/**
 * Cross-field rules: the personal entity, a name that is not empty, a known account type, and a
 * hash that matches the document.
 */
export function checkRecord(decoded: Decoded, entityId: string, path: string): AppError | null {
	const { type, row } = decoded
	if (type === "entity" && row.id !== entityId) {
		return invalid(`${path}.id`, `must be the personal entity ${entityId}`)
	}
	if ("entityId" in row && row.entityId !== entityId) {
		return invalid(`${path}.entityId`, `must be the personal entity ${entityId}`)
	}
	if ("name" in row && row.name === "") return invalid(`${path}.name`, "must not be empty")
	if (type === "account" && !isAccountType(row.type)) {
		return invalid(`${path}.type`, `must be one of ${ACCOUNT_TYPES.join(", ")}`)
	}
	if (type === "scenario" && row.contentHash !== contentHash(row.document)) {
		const details = { expected: contentHash(row.document), actual: row.contentHash }
		return invalid(`${path}.contentHash`, "does not match the canonical document", details)
	}
	return null
}

/** A record's identity within its type, and the field that holds it. */
export function identityOf(decoded: Decoded): { key: string; field: string } {
	if (decoded.type === "posting") {
		return { key: `posting\u0000${decoded.row.txId}\u0000${decoded.row.ordinal}`, field: "ordinal" }
	}
	return { key: `${decoded.type}\u0000${decoded.row.id}`, field: "id" }
}

export function emptyRows(): Rows {
	return { entity: [], account: [], tx: [], posting: [], scenario: [] }
}

export function addRow(rows: Rows, decoded: Decoded): RestoreRows {
	;(rows[decoded.type] as RecordRows[RecordType][]).push(decoded.row)
	return rows
}
