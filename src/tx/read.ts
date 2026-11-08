import { z } from "zod"
import { type AccountRef, accountRef } from "../account/view"
import { type AppError, isAppError } from "../errors"
import {
	formatMinorUnits,
	type PostingRow,
	type Store,
	TX_CORRECTIONS,
	type TxCorrection,
	type TxRow,
} from "../store"

export type ReadPosting = {
	ordinal: number
	account: AccountRef
	/** Signed decimal string in the posting's currency. */
	amount: string
	currency: string
	dimensions: Readonly<Record<string, string>> | null
}

export type ReadTransaction = {
	id: string
	date: string
	memo: string | null
	linkedTo: string | null
	postings: ReadPosting[]
}

export type TransactionRef = { id: string; date: string }

/** A linked row, named as what it is to the transaction it corrects. */
export type CorrectionRef = TransactionRef & { correction: TxCorrection | null }

export type TransactionLinks = {
	/** The transaction this one voids or amends, or null when it corrects nothing. */
	corrects: TransactionRef | null
	/** What this transaction is to `corrects`: a reversal or a replacement, or null. */
	correction: TxCorrection | null
	/** The transactions that void or amend this one, oldest first and then by id. */
	correctedBy: CorrectionRef[]
}

export const readPosting: z.ZodType<ReadPosting> = z.strictObject({
	ordinal: z.number().int().describe("Zero-based position in the transaction."),
	account: accountRef.describe("The account this posting names."),
	amount: z.string().describe("Signed decimal string in the posting's currency."),
	currency: z.string().describe("The posting's ISO 4217 currency."),
	dimensions: z
		.record(z.string(), z.string())
		.nullable()
		.describe("Dimensions that do not change a balance, or null."),
})

export const readTransaction: z.ZodType<ReadTransaction> = z.strictObject({
	id: z.string().describe("The transaction's UUIDv7 id."),
	date: z.string().describe("The transaction's YYYY-MM-DD date."),
	memo: z.string().nullable().describe("The free-text memo, or null."),
	linkedTo: z.string().nullable().describe("The transaction this one corrects, or null."),
	postings: z.array(readPosting).describe("The postings in the order they were written."),
})

export const transactionRef: z.ZodType<TransactionRef> = z.strictObject({
	id: z.string().describe("The linked transaction's id."),
	date: z.string().describe("The linked transaction's YYYY-MM-DD date."),
})

const correction = z
	.enum(TX_CORRECTIONS)
	.nullable()
	.describe("A void's reversal or an amend's replacement; null when this row corrects nothing.")

export const correctionRef: z.ZodType<CorrectionRef> = z.strictObject({
	id: z.string().describe("The linked transaction's id."),
	date: z.string().describe("The linked transaction's YYYY-MM-DD date."),
	correction,
})

export const transactionLinks: z.ZodType<TransactionLinks> = z.strictObject({
	corrects: transactionRef
		.nullable()
		.describe("The transaction this one voids or amends, or null."),
	correction: correction.describe("What this transaction is to `corrects`, or null."),
	correctedBy: z
		.array(correctionRef)
		.describe("The transactions that void or amend this one, by date then id, each named."),
})

/** Every account's name by id, tombstones included, so a posting can always be named. */
export function accountNames(store: Store): ReadonlyMap<string, string> | AppError {
	const accounts = store.listAccounts({ sort: "id", includeDeleted: true })
	return isAppError(accounts) ? accounts : new Map(accounts.map((a) => [a.id, a.name]))
}

/** The transaction with its postings, each posting's account named from `names`. */
export function transactionView(
	tx: TxRow,
	postings: readonly PostingRow[],
	names: ReadonlyMap<string, string>,
): ReadTransaction {
	return {
		id: tx.id,
		date: tx.date,
		memo: tx.memo,
		linkedTo: tx.linkedTo,
		postings: postings.map((row) => ({
			ordinal: row.ordinal,
			account: { id: row.accountId, name: names.get(row.accountId)! },
			amount: formatMinorUnits(row.amount, row.currency),
			currency: row.currency,
			dimensions: row.dimensions,
		})),
	}
}

export function refOf(tx: TxRow): TransactionRef {
	return { id: tx.id, date: tx.date }
}

/** A linked row as its own transaction names it: id, date and what kind of correction it is. */
export function correctionRefOf(tx: TxRow): CorrectionRef {
	return { ...refOf(tx), correction: tx.correctionKind }
}
