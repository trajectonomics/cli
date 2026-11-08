import { z } from "zod"

export type DocumentPosting = {
	account: string
	/** Signed decimal string in the posting's currency; debit is positive. */
	amount: string
	currency: string
	dimensions?: Readonly<Record<string, string>> | undefined
}

export type TransactionDocument = {
	date: string
	memo?: string | undefined
	externalRef?: string | undefined
	postings: DocumentPosting[]
}

const posting: z.ZodType<DocumentPosting> = z.strictObject({
	account: z.string().min(1).describe("The account's exact name or its id."),
	amount: z
		.string()
		.describe("Signed decimal string in the posting's currency; debit is positive."),
	currency: z.string().describe("The posting's ISO 4217 currency; v1 supports THB only."),
	dimensions: z
		.record(z.string(), z.string())
		.optional()
		.describe("Dimension tags that do not change any balance."),
})

/**
 * The JSON document `--postings` reads (ADR-0020). It is a transaction in full: metadata plus
 * signed postings, in the order they should be written.
 */
export const transactionDocument: z.ZodType<TransactionDocument> = z.strictObject({
	date: z
		.string()
		.describe(
			"The transaction's YYYY-MM-DD date; the core rejects an impossible date as INVALID_DATE.",
		),
	memo: z.string().optional().describe("Free text kept with the transaction."),
	externalRef: z
		.string()
		.min(1)
		.optional()
		.describe("An idempotency key; replaying it is a duplicate."),
	postings: z
		.array(posting)
		.describe("At least two signed postings that sum to zero per currency."),
})
