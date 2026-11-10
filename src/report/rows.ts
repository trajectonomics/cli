import type { BalanceRow, Total, TrialBalanceRow, TrialBalanceTotal } from "@trajectonomics/ledger"
import { ref } from "../account/view"
import { type AccountRow, formatMinorUnits } from "../store"
import type { ReportRow, TotalView, TrialRowView, TrialTotalView } from "./view"

/** The stored Account rows, readable by id and ranked in `account list` order. */
export type AccountIndex = {
	byId: ReadonlyMap<string, AccountRow>
	order: ReadonlyMap<string, number>
}

function accountOf(index: AccountIndex, id: string): AccountRow {
	const account = index.byId.get(id)
	// The chart is built from these very rows, so a missing one is a programming error.
	if (account === undefined) throw new Error(`account ${id} is not in the ledger read`)
	return account
}

/** Indexes the stored rows once, so every list of a result can share the same order. */
export function accountIndex(accounts: readonly AccountRow[]): AccountIndex {
	return {
		byId: new Map(accounts.map((account) => [account.id, account])),
		order: new Map(accounts.map((account, position) => [account.id, position])),
	}
}

/** The core's rows in `account list` order, whatever order the core returned them in. */
export function inAccountOrder<T extends { accountId: string }>(
	rows: readonly T[],
	index: AccountIndex,
): T[] {
	const rank = (row: T) => index.order.get(row.accountId) ?? Number.MAX_SAFE_INTEGER
	return [...rows].sort((a, b) => rank(a) - rank(b))
}

export function reportRowOf(row: BalanceRow, index: AccountIndex): ReportRow {
	const account = accountOf(index, row.accountId)
	return {
		account: ref(account),
		type: account.type,
		amount: formatMinorUnits(row.amount, row.currency),
		currency: row.currency,
	}
}

export function totalOf(row: Total): TotalView {
	return { currency: row.currency, amount: formatMinorUnits(row.amount, row.currency) }
}

export function trialRowOf(row: TrialBalanceRow, index: AccountIndex): TrialRowView {
	const account = accountOf(index, row.accountId)
	return {
		account: ref(account),
		debit: formatMinorUnits(row.debit, row.currency),
		credit: formatMinorUnits(row.credit, row.currency),
		currency: row.currency,
	}
}

export function trialTotalOf(row: TrialBalanceTotal): TrialTotalView {
	return {
		currency: row.currency,
		debit: formatMinorUnits(row.debit, row.currency),
		credit: formatMinorUnits(row.credit, row.currency),
	}
}
