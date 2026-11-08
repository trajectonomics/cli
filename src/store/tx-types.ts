import type { PostingRow, TxCorrection, TxRow } from "./rows"

// What a transaction write takes and returns, kept apart from the store's other vocabulary.

export type NewPosting = {
	accountId: string
	/** Signed integer minor units: debit `+`, credit `-`. */
	amount: number
	currency: string
	dimensions?: Readonly<Record<string, string>>
}

export type NewTransaction = {
	date: string
	postings: readonly NewPosting[]
	memo?: string
	linkedTo?: string
	/** What this row is to the transaction it corrects; set exactly when `linkedTo` is. */
	correctionKind?: TxCorrection
	externalRef?: string
}

/** An amend's replacement; the reversal it is paired with is derived from the original. */
export type NewAmendment = {
	/** The amended transaction: its date, postings, memo and new reference. */
	replacement: NewTransaction
	/** The reversal's date; the replacement's date by default (ADR-0018). */
	voidDate?: string
}

export type TxStatus = "added" | "duplicate" | "voided" | "already_corrected"
export type TxWritten<S extends TxStatus> = {
	status: S
	tx: TxRow
	postings: PostingRow[]
}
export type TxAdded = TxWritten<"added" | "duplicate">
export type TxVoided = TxWritten<"voided" | "already_corrected"> | { status: "not_found" }

/** An amend wrote both rows, or found a correction already standing and wrote nothing. */
export type TxAmended =
	| { status: "amended"; reversal: TxWritten<"added">; replacement: TxWritten<"added"> }
	| { status: "already_corrected"; tx: TxRow; postings: PostingRow[] }
	| { status: "not_found" }
