/**
 * The two sentences a dead-end Result names the next command with, their predicate, and the
 * `UNKNOWN_ACCOUNT` sentence that quotes the same account command (ADR-0040). `init` and the
 * five reads take them from here, so no two of them can drift apart.
 */

/** The account command the account sentence quotes: the first example `traj help account add` prints. */
const ACCOUNT_COMMAND = "traj account add Cash --type asset --currency THB"

/** A Result's sentence while the Ledger holds no Account. */
export const ACCOUNT_HINT: string = `Run "${ACCOUNT_COMMAND}" to create your first account.`

/** A Result's sentence while the Ledger holds an Account and no Transaction. */
export const TRANSACTION_HINT: string =
	'Run "traj tx add" to record your first transaction; it takes --date, --from, --to and --amount.'

/** `UNKNOWN_ACCOUNT`'s sentence: the chart the caller may already hold, and the way to create one. */
export const UNKNOWN_ACCOUNT_HINT: string = `Run "traj account list" to see the chart, or "${ACCOUNT_COMMAND}" to create one.`

/** What the predicate reads: whether the store holds each kind of row. */
export type StoredCounts = {
	readonly accounts: number
	readonly transactions: number
}

/**
 * The sentence a dead-end Result carries, or `undefined` when the store has something to show:
 * no Account → the account sentence; an Account but no Transaction → the transaction sentence.
 * A read that is empty for another reason — a filter, an `--as-of` before the record — asks this
 * of the store and gets nothing, because the store is not why it is empty.
 */
export function hintOf(counts: StoredCounts): string | undefined {
	if (counts.accounts === 0) return ACCOUNT_HINT
	if (counts.transactions === 0) return TRANSACTION_HINT
	return undefined
}

/** The result field to spread beside the values: present only when there is a sentence. */
export function hintField(hint: string | undefined): { hint?: string } {
	return hint === undefined ? {} : { hint }
}
