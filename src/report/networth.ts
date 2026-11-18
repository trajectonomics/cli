import { netWorth, type Transaction } from "@trajectonomics/ledger"
import { checkedDate } from "../date"
import type { AppError } from "../errors"
import { isAppError } from "../errors"
import { hintField } from "../hint"
import type { Ledger } from "../store"
import { type FieldMap, type FieldRules, query, respell } from "./errors"
import { reportHint } from "./hint"
import { accountIndex, reportRowsOf, totalsOf } from "./rows"
import type { ReportRow, TotalView } from "./view"

// The core names its own query; respell those paths into this result's keys.
const FIELDS: FieldRules = [
	["netWorth.rows[", "rows["],
	["netWorth.totals[", "totals["],
]

/** A non-counted leaf can overflow as `netWorth[<id>]`; what it blocks is the bottom line. */
const fieldOf: FieldMap = (field) =>
	field.startsWith("netWorth[") ? "totals" : respell(field, FIELDS)

/** `traj report networth`: the asset and liability rows behind net worth, and the total per currency. */
export type NetWorthResult = {
	asOf: string
	/** The earliest date the Ledger records, or null when it records none (ADR-0029). */
	firstTransactionDate: string | null
	/** True when the As-of precedes every Transaction, so a zero states no record, not no money. */
	noTransactionsBefore: boolean
	rows: ReportRow[]
	totals: TotalView[]
	hint?: string | undefined
}

/** The earliest dated Transaction, whatever order the store returned them in. */
function firstTransactionDateOf(transactions: readonly Transaction[]): string | null {
	let first: string | null = null
	for (const transaction of transactions) {
		if (first === null || transaction.date < first) first = transaction.date
	}
	return first
}

/** Assembles net worth from one assembled read; the Command only renders it. */
export function netWorthOf(ledger: Ledger, asOf: string): NetWorthResult | AppError {
	const date = checkedDate(asOf, "asOf")
	if (isAppError(date)) return date
	const index = accountIndex(ledger.accounts)
	const result = query(() => netWorth(ledger.transactions, asOf, ledger.chart), fieldOf)
	if (isAppError(result)) return result
	const firstTransactionDate = firstTransactionDateOf(ledger.transactions)
	const rows = reportRowsOf(result.rows, index)
	const hint = reportHint(ledger, rows)
	return {
		asOf,
		firstTransactionDate,
		noTransactionsBefore: firstTransactionDate !== null && firstTransactionDate > asOf,
		rows,
		totals: totalsOf(result.totals),
		...hintField(hint),
	}
}
