import type { ProfitAndLossOptions } from "@trajectonomics/ledger"
import { profitAndLoss } from "@trajectonomics/ledger"
import type { AppError } from "../errors"
import { isAppError } from "../errors"
import type { Ledger } from "../store"
import { type FieldRules, query } from "./errors"
import { accountIndex, inAccountOrder, reportRowOf, totalOf } from "./rows"
import type { ReportRow, TotalView } from "./view"

// The core names its own queries and period options; respell them into this result's keys.
const FIELDS: FieldRules = [
	["profitAndLoss.rows[", "rows["],
	["profitAndLoss.totals[", "totals["],
	["options.from", "since"],
	["options.to", "until"],
]

/** `traj report pnl`: income minus expenses over an inclusive period, optionally by Project. */
export type PnlResult = {
	since: string | null
	until: string
	project: string | null
	rows: ReportRow[]
	totals: TotalView[]
}

function optionsOf(input: {
	since?: string | undefined
	until: string
	project?: string | undefined
}): ProfitAndLossOptions {
	return {
		to: input.until,
		...(input.since === undefined ? {} : { from: input.since }),
		...(input.project === undefined ? {} : { where: { project: input.project } }),
	}
}

/** Assembles the P&L from one assembled read; the Command only renders it. */
export function pnlOf(
	ledger: Ledger,
	input: { since?: string | undefined; until: string; project?: string | undefined },
): PnlResult | AppError {
	const index = accountIndex(ledger.accounts)
	const result = query(
		() => profitAndLoss(ledger.transactions, optionsOf(input), ledger.chart),
		FIELDS,
	)
	if (isAppError(result)) return result
	return {
		since: input.since ?? null,
		until: input.until,
		project: input.project ?? null,
		rows: inAccountOrder(result.rows, index).map((row) => reportRowOf(row, index)),
		totals: result.totals.map(totalOf),
	}
}
