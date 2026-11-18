import { notFound } from "../account/errors"
import type { Result } from "../command"
import { ok } from "../command"
import { type AppError, isAppError } from "../errors"
import { hintField, hintOf } from "../hint"
import type { PostingRow, Store, TxFilter, TxRow } from "../store"
import { dateError, periodError } from "./date-filter"
import { accountNames, type ReadTransaction, transactionView } from "./read"

/** The flags `tx list` filters with: the Command's own input, structurally. */
export type TransactionQuery = {
	since?: string | undefined
	until?: string | undefined
	account?: string | undefined
	project?: string | undefined
}

/** One read of the matching Transactions, and the hint an empty answer earns. */
export type TransactionList = {
	transactions: ReadTransaction[]
	hint?: string | undefined
}

/** Turns the flags into a store filter; `--account` resolves to an id or fails as `not_found`. */
function filterOf(query: TransactionQuery, store: Store): TxFilter | AppError {
	const invalid =
		dateError(query.since, "since") ??
		dateError(query.until, "until") ??
		periodError(query.since, query.until)
	if (invalid) return invalid
	const filter: TxFilter = {}
	if (query.since !== undefined) filter.since = query.since
	if (query.until !== undefined) filter.until = query.until
	if (query.account !== undefined) {
		const account = store.getAccount(query.account)
		if (isAppError(account)) return account
		if (account === null) return notFound(query.account)
		filter.accountId = account.id
	}
	if (query.project !== undefined) filter.project = query.project
	return filter
}

/** The rows the filter matches, in date order, and every posting they carry. */
function rowsOf(
	store: Store,
	query: TransactionQuery,
): { txs: TxRow[]; postings: PostingRow[] } | AppError {
	const filter = filterOf(query, store)
	if (isAppError(filter)) return filter
	const txs = store.listTransactions({ sort: "date", ...filter })
	if (isAppError(txs)) return txs
	const postings = store.listPostings({ sort: "tx_id", filter })
	if (isAppError(postings)) return postings
	return { txs, postings }
}

/**
 * An empty `tx list` is the one read the chart decides the sentence for, and the one whose
 * filter can empty it while the store is full: counting the store, not the filter, tells the two
 * apart, so a `--since` after the last posting asks the caller about the filter, not the ledger.
 */
function hintOfEmptyList(store: Store): string | AppError | undefined {
	const accounts = store.listAccounts({ sort: "name" })
	if (isAppError(accounts)) return accounts
	const stored = store.listTransactions({ sort: "id" })
	if (isAppError(stored)) return stored
	return hintOf({ accounts: accounts.length, transactions: stored.length })
}

/** The matching transactions with their postings, narrowed to one Project's when asked. */
function viewed(
	txs: readonly TxRow[],
	postings: readonly PostingRow[],
	names: ReadonlyMap<string, string>,
	project: string | undefined,
): ReadTransaction[] {
	const byTx = Map.groupBy(postings, (posting) => posting.txId)
	const postingsOf = (txId: string) => {
		const all = byTx.get(txId) ?? []
		return project === undefined
			? all
			: all.filter((posting) => posting.dimensions?.["project"] === project)
	}
	return txs.map((tx) => transactionView(tx, postingsOf(tx.id), names))
}

/** Assembles `tx list` from one store read; the Command only renders it. */
export function listOf(store: Store, query: TransactionQuery): Result<TransactionList> | AppError {
	const rows = rowsOf(store, query)
	if (isAppError(rows)) return rows
	const names = accountNames(store)
	if (isAppError(names)) return names
	const hint = rows.txs.length === 0 ? hintOfEmptyList(store) : undefined
	if (isAppError(hint)) return hint
	return ok({
		transactions: viewed(rows.txs, rows.postings, names, query.project),
		...hintField(hint),
	})
}
