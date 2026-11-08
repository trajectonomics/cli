import { z } from "zod"
import { formatMinorUnits, type PostingRow, type TxStatus, type TxWritten } from "../store"

export type WrittenPosting = {
	ordinal: number
	accountId: string
	/** Signed decimal string in the posting's currency. */
	amount: string
	currency: string
	dimensions: Readonly<Record<string, string>> | null
}

export type WrittenTransaction<S extends TxStatus = TxStatus> = {
	dryRun: boolean
	status: S
	transaction: {
		/** Null under --dry-run. */
		id: string | null
		date: string
		memo: string | null
		linkedTo: string | null
		externalRef: string | null
		version: number
		createdAt: string
		updatedAt: string
		postings: WrittenPosting[]
	}
}

const posting: z.ZodType<WrittenPosting> = z.strictObject({
	ordinal: z.number().int().describe("Zero-based position in the transaction."),
	accountId: z.string().describe("The account's UUIDv7 id."),
	amount: z.string().describe("Signed decimal string in the posting's currency."),
	currency: z.string().describe("The posting's ISO 4217 currency."),
	dimensions: z
		.record(z.string(), z.string())
		.nullable()
		.describe("Dimension tags that do not change a balance, or null."),
})

/** The output schema shared by every command that writes one transaction row. */
export function writtenTransactionSchema<S extends TxStatus>(
	statuses: readonly [S, ...S[]],
	description: string,
): z.ZodType<WrittenTransaction<S>> {
	return z.strictObject({
		dryRun: z.boolean().describe("True when the write was rolled back."),
		status: z.enum(statuses).describe(description),
		transaction: z.strictObject({
			id: z.string().nullable().describe("The transaction's id; null under --dry-run."),
			date: z.string().describe("The transaction's YYYY-MM-DD date."),
			memo: z.string().nullable().describe("The free-text memo, or null."),
			linkedTo: z.string().nullable().describe("The transaction this one corrects, or null."),
			externalRef: z.string().nullable().describe("The caller's idempotency key, or null."),
			version: z.number().int().describe("The row's version."),
			createdAt: z.string().describe("When the row was created."),
			updatedAt: z.string().describe("When the row was last changed."),
			postings: z.array(posting).describe("The postings in the order they were written."),
		}),
	})
}

export const writtenTransaction: z.ZodType<WrittenTransaction<"added" | "duplicate">> =
	writtenTransactionSchema(["added", "duplicate"], "What the add found.")

// A write mints an id under a dry run and rolls it back, so the id is stated as null.
const MINTED_STATUSES: ReadonlySet<TxStatus> = new Set(["added", "voided"])

function viewPosting(row: PostingRow): WrittenPosting {
	return {
		ordinal: row.ordinal,
		accountId: row.accountId,
		amount: formatMinorUnits(row.amount, row.currency),
		currency: row.currency,
		dimensions: row.dimensions,
	}
}

/** The row written, with its postings; under a dry run the generated id is stated as null. */
export function viewTransaction<S extends TxStatus>(
	written: TxWritten<S>,
	dryRun: boolean,
): WrittenTransaction<S> {
	const { tx, postings } = written
	return {
		dryRun,
		status: written.status,
		transaction: {
			// A generated id is always null under a dry run; an existing row keeps its id.
			id: dryRun && MINTED_STATUSES.has(written.status) ? null : tx.id,
			date: tx.date,
			memo: tx.memo,
			linkedTo: tx.linkedTo,
			externalRef: tx.externalRef,
			version: tx.version,
			createdAt: tx.createdAt,
			updatedAt: tx.updatedAt,
			postings: postings.map(viewPosting),
		},
	}
}
