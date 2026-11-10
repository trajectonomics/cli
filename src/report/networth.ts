import { netWorth } from "@trajectonomics/ledger"
import type { AppError } from "../errors"
import { isAppError } from "../errors"
import type { Ledger } from "../store"
import { type FieldRules, query } from "./errors"
import { accountIndex, inAccountOrder, reportRowOf, totalOf } from "./rows"
import type { ReportRow, TotalView } from "./view"

// The core names its own query; respell those paths into this result's keys.
const FIELDS: FieldRules = [
	["netWorth.rows[", "rows["],
	["netWorth.totals[", "totals["],
]

/** `traj report networth`: the asset and liability rows behind net worth, and the total per currency. */
export type NetWorthResult = {
	asOf: string
	rows: ReportRow[]
	totals: TotalView[]
}

/** Assembles net worth from one assembled read; the Command only renders it. */
export function netWorthOf(ledger: Ledger, asOf: string): NetWorthResult | AppError {
	const index = accountIndex(ledger.accounts)
	const result = query(() => netWorth(ledger.transactions, asOf, ledger.chart), FIELDS)
	if (isAppError(result)) return result
	return {
		asOf,
		rows: inAccountOrder(result.rows, index).map((row) => reportRowOf(row, index)),
		totals: result.totals.map(totalOf),
	}
}
