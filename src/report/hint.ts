import { hintOf } from "../hint"
import type { Ledger } from "../store"
import type { ReportRow } from "./view"

/**
 * The hint a report's rows earn: an empty answer is the only one that asks the store why, and
 * only the store can say which command fills it (ADR-0040). `balance`, `report networth` and
 * `report pnl` share it so their three results cannot choose differently.
 */
export function reportHint(ledger: Ledger, rows: readonly ReportRow[]): string | undefined {
	return rows.length === 0
		? hintOf({ accounts: ledger.accounts.length, transactions: ledger.transactions.length })
		: undefined
}
