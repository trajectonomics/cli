import { balances, netWorth, trialBalance } from "@trajectonomics/ledger"
import type { AppError } from "../errors"
import { fail, isAppError } from "../errors"
import type { Ledger } from "../store"
import { type FieldRules, query } from "./errors"
import {
	type AccountIndex,
	accountIndex,
	inAccountOrder,
	reportRowOf,
	totalOf,
	trialRowOf,
	trialTotalOf,
} from "./rows"
import type { ReportRow, TotalView, TrialBalanceView } from "./view"

// The core names its own queries; every one of these paths is respelled into this result's keys.
const FIELDS: FieldRules = [
	["balances[", "rows["],
	["netWorth.totals[", "netWorth["],
	["netWorth.rows[", "rows["],
]

/** `traj balance`: every Leaf Account's Balance, the net-worth total, and an optional Trial Balance. */
export type BalanceResult = {
	asOf: string
	rows: ReportRow[]
	netWorth: TotalView[]
	trialBalance?: TrialBalanceView | undefined
}

function readings(ledger: Ledger, asOf: string) {
	const rows = query(() => balances(ledger.transactions, asOf, ledger.chart), FIELDS)
	if (isAppError(rows)) return rows
	const worth = query(() => netWorth(ledger.transactions, asOf, ledger.chart), FIELDS)
	if (isAppError(worth)) return worth
	return { rows, totals: worth.totals }
}

/**
 * The Trial Balance, asserting the one thing it exists to say: each currency's debits equal its
 * credits. The core re-validates every stored Transaction, so a tampered Posting fails earlier
 * with UNBALANCED_TRANSACTION; this guards a core arithmetic bug and is not a declared code.
 */
function trialOf(ledger: Ledger, asOf: string, index: AccountIndex) {
	const result = query(() => trialBalance(ledger.transactions, asOf, ledger.chart), [])
	if (isAppError(result)) return result
	const unbalanced = result.totals.find((row) => row.debit !== row.credit)
	if (unbalanced !== undefined) {
		return fail("internal", {
			message: "The trial balance's debit and credit totals do not agree.",
			details: {
				currency: unbalanced.currency,
				debit: unbalanced.debit,
				credit: unbalanced.credit,
			},
		})
	}
	return {
		rows: inAccountOrder(result.rows, index).map((row) => trialRowOf(row, index)),
		totals: result.totals.map(trialTotalOf),
	}
}

/** Assembles the balance result from one assembled read; the Command only renders it. */
export function balanceOf(
	ledger: Ledger,
	input: { asOf: string; trialBalance?: boolean | undefined },
): BalanceResult | AppError {
	const index = accountIndex(ledger.accounts)
	const read = readings(ledger, input.asOf)
	if (isAppError(read)) return read
	const trial = input.trialBalance === true ? trialOf(ledger, input.asOf, index) : undefined
	if (isAppError(trial)) return trial
	return {
		asOf: input.asOf,
		rows: inAccountOrder(read.rows, index).map((row) => reportRowOf(row, index)),
		netWorth: read.totals.map(totalOf),
		...(trial === undefined ? {} : { trialBalance: trial }),
	}
}
