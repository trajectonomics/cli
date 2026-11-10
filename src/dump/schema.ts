import { z } from "zod"
import { ACCOUNT_TYPE_VALUES } from "../account/view"
import { TX_CORRECTIONS } from "../store"
import type {
	DumpAccountRow,
	DumpEntityRow,
	DumpPostingRow,
	DumpScenarioRow,
	DumpTxRow,
} from "./view"

const sync = {
	version: z.number().int().describe("The row's version."),
	createdAt: z.string().describe("When the row was created, verbatim."),
	updatedAt: z.string().describe("When the row was last changed, verbatim."),
}

const deletedAt = z.string().nullable().describe("When the row was tombstoned, or null.")

export const dumpEntity: z.ZodType<DumpEntityRow> = z.strictObject({
	id: z.string().describe("The entity's id."),
	name: z.string().describe("The entity's name."),
	...sync,
	deletedAt,
})

export const dumpAccount: z.ZodType<DumpAccountRow> = z.strictObject({
	id: z.string().describe("The account's id."),
	entityId: z.string().describe("The owning entity's id."),
	name: z.string().describe("The account's exact name."),
	type: z.enum(ACCOUNT_TYPE_VALUES).describe("asset, liability, equity, income or expense."),
	currency: z.string().describe("The account's ISO 4217 currency."),
	parentId: z.string().nullable().describe("The parent account's id, or null at the top level."),
	archivedAt: z.string().nullable().describe("When the account was archived, or null."),
	...sync,
	deletedAt,
})

export const dumpTx: z.ZodType<DumpTxRow> = z.strictObject({
	id: z.string().describe("The transaction's id."),
	entityId: z.string().describe("The owning entity's id."),
	date: z.string().describe("The transaction's date, YYYY-MM-DD."),
	memo: z.string().nullable().describe("The memo as stored, or null."),
	linkedTo: z.string().nullable().describe("The id this transaction corrects, or null."),
	externalRef: z.string().nullable().describe("The idempotency key, or null."),
	...sync,
	correctionKind: z
		.enum(TX_CORRECTIONS)
		.nullable()
		.describe("reversal or replacement when linkedTo is set, otherwise null."),
})

export const dumpPosting: z.ZodType<DumpPostingRow> = z.strictObject({
	txId: z.string().describe("The transaction this posting belongs to."),
	ordinal: z.number().int().describe("The posting's position in its transaction, from 0."),
	accountId: z.string().describe("The account this posting is against."),
	amount: z.string().describe("The signed amount as the currency's decimal string (ADR-0009)."),
	currency: z.string().describe("The posting's ISO 4217 currency."),
	dimensions: z
		.record(z.string(), z.string())
		.nullable()
		.describe("The posting's dimensions as an object, or null when it has none."),
})

export const dumpScenario: z.ZodType<DumpScenarioRow> = z.strictObject({
	id: z.string().describe("The scenario's id."),
	entityId: z.string().describe("The owning entity's id."),
	name: z.string().describe("The scenario's exact name."),
	document: z.string().describe("The document's stored RFC 8785 canonical JSON text."),
	contentHash: z.string().describe("`jcs1:sha256:<hex>` of the document."),
	forkedFrom: z
		.string()
		.nullable()
		.describe("The id of the scenario this was forked from, or null."),
	...sync,
	deletedAt,
})

/** One schema per table, each with its row's exact keys and types. */
export type DumpRowSchemas = {
	entity: typeof dumpEntity
	account: typeof dumpAccount
	tx: typeof dumpTx
	posting: typeof dumpPosting
	scenario: typeof dumpScenario
}

/** One strict schema per table, with the row view's exact keys. */
export const dumpRowSchema: DumpRowSchemas = {
	entity: dumpEntity,
	account: dumpAccount,
	tx: dumpTx,
	posting: dumpPosting,
	scenario: dumpScenario,
}
