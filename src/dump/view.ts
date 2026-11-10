import { formatMinorUnits, type RestoreRows, type TxCorrection } from "../store"

/**
 * What a person sees of one stored row: the store's row with money as the currency's decimal
 * string (ADR-0009) and the Scenario document as its stored canonical text. Nothing is dropped,
 * renamed or reordered, so a row can be quoted from any surface and found in the database.
 */
export type DumpEntityRow = {
	id: string
	name: string
	version: number
	createdAt: string
	updatedAt: string
	deletedAt: string | null
}

export type DumpAccountRow = {
	id: string
	entityId: string
	name: string
	type: string
	currency: string
	parentId: string | null
	archivedAt: string | null
	version: number
	createdAt: string
	updatedAt: string
	deletedAt: string | null
}

export type DumpTxRow = {
	id: string
	entityId: string
	date: string
	memo: string | null
	linkedTo: string | null
	externalRef: string | null
	version: number
	createdAt: string
	updatedAt: string
	correctionKind: TxCorrection | null
}

export type DumpPostingRow = {
	txId: string
	ordinal: number
	accountId: string
	amount: string
	currency: string
	dimensions: Readonly<Record<string, string>> | null
}

export type DumpScenarioRow = {
	id: string
	entityId: string
	name: string
	document: string
	contentHash: string
	forkedFrom: string | null
	version: number
	createdAt: string
	updatedAt: string
	deletedAt: string | null
}

/** Every table's rows in view form, keyed like the store's own row set. */
export type DumpRows = {
	entity: DumpEntityRow[]
	account: DumpAccountRow[]
	tx: DumpTxRow[]
	posting: DumpPostingRow[]
	scenario: DumpScenarioRow[]
}

/** The tables a dump holds, in the order the export writes them. */
export const DUMP_TABLES = ["entity", "account", "tx", "posting", "scenario"] as const
export type DumpTable = (typeof DUMP_TABLES)[number]

export function isDumpTable(value: string): value is DumpTable {
	return DUMP_TABLES.some((table) => table === value)
}

/** The dump as every surface shows it: one row view, built once from the one dump read. */
export function viewDump(rows: RestoreRows): DumpRows {
	return {
		entity: rows.entity.map((row) => ({ ...row })),
		account: rows.account.map((row) => ({ ...row })),
		tx: rows.tx.map((row) => ({ ...row })),
		posting: rows.posting.map((row) => ({
			...row,
			amount: formatMinorUnits(row.amount, row.currency),
		})),
		scenario: rows.scenario.map((row) => ({ ...row })),
	}
}
