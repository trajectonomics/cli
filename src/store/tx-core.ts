import { type ChartOfAccounts, type Transaction, validateTransaction } from "@trajectonomics/ledger"
import type { NewPosting, PostingRow, TxRow } from "./types"

/** A stored or core posting as a new-posting input; absent and null dimensions both mean none. */
export function postingInput(
	posting: Pick<PostingRow, "accountId" | "amount" | "currency"> & {
		dimensions?: Readonly<Record<string, string>> | null
	},
): NewPosting {
	const { dimensions, ...rest } = posting
	const dimensionProps = dimensions === null || dimensions === undefined ? {} : { dimensions }
	return { ...rest, ...dimensionProps }
}

/** Rebuild the core's validated transaction from its stored row and ordered postings. */
export function coreTransaction(
	tx: TxRow,
	postings: readonly PostingRow[],
	chart: ChartOfAccounts,
): Transaction {
	const linked = tx.linkedTo === null ? {} : { linkedTo: tx.linkedTo }
	return validateTransaction(
		{ id: tx.id, date: tx.date, postings: postings.map(postingInput), ...linked },
		chart,
	)
}
