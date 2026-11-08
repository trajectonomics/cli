import type { AccountType } from "@trajectonomics/ledger"

// Store-owned row shapes. Keys are declared in column order, so a writer that walks them in
// declaration order sees the table's own order. Money is integer minor units; timestamps are
// `YYYY-MM-DDTHH:MM:SS.sssZ`; a missing optional value is `null`, never absent.

/** What a linked transaction is to the one it corrects: a void's reversal, or an amend's replacement. */
export const TX_CORRECTIONS = ["reversal", "replacement"] as const
export type TxCorrection = (typeof TX_CORRECTIONS)[number]

export function isTxCorrection(value: unknown): value is TxCorrection {
	return TX_CORRECTIONS.some((kind) => kind === value)
}

export type EntityRow = {
	id: string
	name: string
	version: number
	createdAt: string
	updatedAt: string
	deletedAt: string | null
}

export type AccountRow = {
	id: string
	entityId: string
	name: string
	type: AccountType
	currency: string
	parentId: string | null
	archivedAt: string | null
	version: number
	createdAt: string
	updatedAt: string
	deletedAt: string | null
}

export type TxRow = {
	id: string
	entityId: string
	date: string
	memo: string | null
	linkedTo: string | null
	externalRef: string | null
	version: number
	createdAt: string
	updatedAt: string
	/** Set exactly when `linkedTo` is (ADR-0016); the store and the interchange both enforce it. */
	correctionKind: TxCorrection | null
}

/** Keyed `(txId, ordinal)`; carries no sync columns (ADR-0017). `ordinal` starts at 0. */
export type PostingRow = {
	txId: string
	ordinal: number
	accountId: string
	amount: number
	currency: string
	dimensions: Readonly<Record<string, string>> | null
}

export type ScenarioRow = {
	id: string
	entityId: string
	name: string
	/** The document's RFC 8785 (JCS) canonical JSON text, exactly as stored. */
	document: string
	/** `jcs1:sha256:<hex>` of `document`. */
	contentHash: string
	forkedFrom: string | null
	version: number
	createdAt: string
	updatedAt: string
	deletedAt: string | null
}
