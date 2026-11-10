import type { ChartOfAccounts, Transaction } from "@trajectonomics/ledger"
import { LedgerValidationError } from "@trajectonomics/ledger"
import type { AppError, ErrorCode } from "../errors"
import { isAppError } from "../errors"
import { listAccounts } from "./accounts"
import { type ChartRow, chartFrom, chartRows } from "./chart"
import type { Ctx } from "./context"
import { guard } from "./guard"
import { ledgerFailure } from "./ledger-errors"
import { coreTransaction } from "./tx-core"
import { listPostings, listTransactions } from "./tx-reads"
import type { AccountRow, PostingRow, TxRow } from "./types"

/**
 * The Ledger as a report needs it: the chart the core validates against, the core's Transactions
 * in store order, and the stored Account rows in `account list` order. The core's Account has no
 * name, so the rows travel beside it.
 */
export type Ledger = {
	chart: ChartOfAccounts
	transactions: readonly Transaction[]
	accounts: readonly AccountRow[]
}

/**
 * Every code the assembled read can raise: building the chart, then re-validating each stored
 * Transaction. A Command that reads the Ledger declares these; `INVALID_DATE` is the Command's
 * own required date flag, so the read does not repeat it.
 */
export const LEDGER_READ_CODES: readonly ErrorCode[] = [
	"INVALID_ACCOUNT_HIERARCHY",
	"SINGLE_POSTING",
	"INVALID_AMOUNT",
	"ZERO_AMOUNT_POSTING",
	"UNKNOWN_ACCOUNT",
	"NON_LEAF_ACCOUNT",
	"CURRENCY_MISMATCH",
	"UNBALANCED_TRANSACTION",
	"INVALID_CURRENCY",
	"INVALID_DIMENSION",
	"DUPLICATE_TRANSACTION_ID",
]

const CHART_FIELD = /^accounts\[(\d+)\]/

/**
 * The account row a chart rejection names: the core indexes its input, and an index is not
 * something a caller can point at, so the row's own id replaces it.
 */
function accountPath(rows: readonly ChartRow[], field: string): string {
	const index = Number(CHART_FIELD.exec(field)?.[1] ?? -1)
	const id = rows[index]?.id
	return id === undefined ? "accounts" : `accounts.${id}`
}

function chartOrFailure(ctx: Ctx): ChartOfAccounts | AppError {
	const rows = chartRows(ctx)
	try {
		return chartFrom(ctx, rows)
	} catch (error) {
		if (!(error instanceof LedgerValidationError)) throw error
		return ledgerFailure(error, accountPath(rows, error.field))
	}
}

function transactionOrFailure(
	tx: TxRow,
	postings: readonly PostingRow[],
	chart: ChartOfAccounts,
): Transaction | AppError {
	try {
		return coreTransaction(tx, postings, chart)
	} catch (error) {
		if (!(error instanceof LedgerValidationError)) throw error
		return ledgerFailure(error, `transactions.${tx.id}`)
	}
}

function assemble(ctx: Ctx): Ledger | AppError {
	const accounts = listAccounts(ctx, { sort: "name" })
	if (isAppError(accounts)) return accounts
	const chart = chartOrFailure(ctx)
	if (isAppError(chart)) return chart
	const rows = listTransactions(ctx, { sort: "id" })
	if (isAppError(rows)) return rows
	const postings = listPostings(ctx, { sort: "tx_id" })
	if (isAppError(postings)) return postings
	const byTx = Map.groupBy(postings, (posting) => posting.txId)
	const transactions: Transaction[] = []
	for (const tx of rows) {
		const checked = transactionOrFailure(tx, byTx.get(tx.id) ?? [], chart)
		if (isAppError(checked)) return checked
		transactions.push(checked)
	}
	return { chart, transactions, accounts }
}

/** One read of the whole Ledger, in the store's own orders; every query's rules re-validate it. */
export function readLedger(ctx: Ctx): Ledger | AppError {
	return guard(() => assemble(ctx))
}
