import { z } from "zod"
import { TX_CORRECTIONS, type TxCorrection, type TxRow } from "../store"

/** A transaction named by what a link needs: its id and its date. */
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

/** A transaction as a link names it. */
export function refOf(tx: TxRow): TransactionRef {
	return { id: tx.id, date: tx.date }
}

/** A linked row as its own transaction names it: id, date and what kind of correction it is. */
export function correctionRefOf(tx: TxRow): CorrectionRef {
	return { ...refOf(tx), correction: tx.correctionKind }
}
