import type { AccountRow, EntityRow, PostingRow, ScenarioRow, TxRow } from "../store"

/** Bumped when an existing field changes meaning; adding a field keeps it (ADR-0017). */
export const FORMAT_VERSION = 1

/**
 * How a field is written and read back. `time` is `YYYY-MM-DDTHH:MM:SS.sssZ`; `amount` is an
 * ADR-0009 decimal string in the record's `currency`; `dimensions` is an object of strings or
 * `null`, never `{}`; `document` is a JSON object written as its RFC 8785 canonical text;
 * `correction` is `reversal`, `replacement` or `null`.
 */
export type FieldKind =
	| "text"
	| "text?"
	| "time"
	| "time?"
	| "int"
	| "amount"
	| "dimensions"
	| "document"
	| "correction"

type Fields<Row> = { readonly [K in keyof Row]-?: FieldKind }

/** One record type per table, keyed like the store's rows. */
export type RecordRows = {
	entity: EntityRow
	account: AccountRow
	tx: TxRow
	posting: PostingRow
	scenario: ScenarioRow
}
export type RecordType = keyof RecordRows

/** Every row of a dump, listed by record type. */
export type RowList = { [T in RecordType]: RecordRows[T][] }

/** The fixed order record types appear in after the header. */
export const RECORD_ORDER: readonly RecordType[] = [
	"entity",
	"account",
	"tx",
	"posting",
	"scenario",
]

const SYNC = { version: "int", createdAt: "time", updatedAt: "time" } as const

/**
 * The writer's declared key order for each record, after its leading `"record"` key. The reader
 * accepts exactly these keys in exactly this order.
 */
export const FIELDS: { readonly [T in RecordType]: Fields<RecordRows[T]> } = {
	entity: { id: "text", name: "text", ...SYNC, deletedAt: "time?" },
	account: {
		id: "text",
		entityId: "text",
		name: "text",
		type: "text",
		currency: "text",
		parentId: "text?",
		archivedAt: "time?",
		...SYNC,
		deletedAt: "time?",
	},
	tx: {
		id: "text",
		entityId: "text",
		date: "text",
		memo: "text?",
		linkedTo: "text?",
		externalRef: "text?",
		...SYNC,
		correctionKind: "correction",
	},
	posting: {
		txId: "text",
		ordinal: "int",
		accountId: "text",
		amount: "amount",
		currency: "text",
		dimensions: "dimensions",
	},
	scenario: {
		id: "text",
		entityId: "text",
		name: "text",
		document: "document",
		contentHash: "text",
		forkedFrom: "text?",
		...SYNC,
		deletedAt: "time?",
	},
}
