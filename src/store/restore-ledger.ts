import { LedgerValidationError } from "@trajectonomics/ledger"
import { type AppError, isAppError } from "../errors"
import { chartOf } from "./chart"
import type { Ctx } from "./context"
import { coreTransaction } from "./tx-core"
import { listPostings, listTransactions } from "./tx-reads"
import type { PostingRow, TxRow } from "./types"

/** The core's rejection of one transaction, its field prefixed with `tx.<id>.`. */
function validate(tx: TxRow, postings: readonly PostingRow[], chart: ReturnType<typeof chartOf>) {
	try {
		coreTransaction(tx, postings, chart)
	} catch (error) {
		if (!(error instanceof LedgerValidationError)) throw error
		const field = `tx.${tx.id}.${error.field}`.replace(/\.$/, "")
		throw new LedgerValidationError(error.code, field, error.value, error.reason)
	}
}

/**
 * Validates restored rows the way a write validates new ones: the chart of every non-tombstoned
 * account, archived ones included (a posting to an archived account is valid history), and every
 * transaction with its postings in `ordinal` order. Must run inside `write`: the core's
 * `LedgerValidationError` propagates to `guard`, which maps it and rolls the restore back.
 */
export function checkLedger(ctx: Ctx): AppError | null {
	const chart = chartOf(ctx)
	const txs = listTransactions(ctx, { sort: "id" })
	if (isAppError(txs)) return txs
	const postings = listPostings(ctx, { sort: "tx_id" })
	if (isAppError(postings)) return postings
	const byTx = Map.groupBy(postings, (p) => p.txId)
	for (const tx of txs) validate(tx, byTx.get(tx.id) ?? [], chart)
	return null
}
