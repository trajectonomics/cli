import type { BalanceRow, ISODate } from "@trajectonomics/ledger"
import { balances, LedgerValidationError } from "@trajectonomics/ledger"
import type { Baseline } from "@trajectonomics/sim"
import { checkedAsOf } from "../date"
import type { AppError } from "../errors"
import { fail, isAppError } from "../errors"
import type { AccountRow, Ledger } from "../store"
import { formatMinorUnits, ledgerFailure, supportedCurrency } from "../store"
import { CROSSING, type SimKind } from "./kind"

/** One Balance as the engine holds it: the Account, the kind it implies, and engine units. */
export type MappedBalance = {
	account: { id: string; name: string }
	kind: SimKind
	/** Non-negative minor units, as the engine's own document states them. */
	amount: number
}

/** The engine's own document, plus what the CLI reports beside each figure (ADR-0026). */
export type BaselineMapping = {
	document: Baseline
	balances: readonly MappedBalance[]
}

const BALANCES_FIELD = /^balances\[(.+)\]$/

/** A core field respelled as this result's key: `balances[<id>]` → `rows.<id>`. */
function fieldPath(field: string): string {
	const id = BALANCES_FIELD.exec(field)?.[1]
	return id === undefined ? field : `rows.${id}`
}

function accountOf(accounts: readonly AccountRow[], id: string): AccountRow {
	const account = accounts.find((row) => row.id === id)
	// The chart is built from these very rows, so a missing one is a programming error.
	if (account === undefined) throw new Error(`account ${id} is not in the ledger read`)
	return account
}

/**
 * One Balance as a Baseline row, or `undefined` when it does not cross. A zero is dropped before
 * the sign flip, so no `-0` reaches the document; a Balance that would be negative once stated is
 * refused rather than dropped or clamped, because the engine's amount is non-negative and either
 * silence would make the Baseline disagree with the Ledger without saying so (ADR-0026).
 */
function mappedOf(
	row: BalanceRow,
	accounts: readonly AccountRow[],
): MappedBalance | AppError | undefined {
	const account = accountOf(accounts, row.accountId)
	const kind = CROSSING[account.type]
	if (kind === undefined) return undefined
	const path = `rows.${account.id}`
	// Checked on every row, a zero one included: a hand-edited dump must not be labelled THB.
	const unsupported = supportedCurrency(row.currency, path)
	if (unsupported !== null) return unsupported
	if (row.amount === 0) return undefined
	const amount = kind === "liability" ? -row.amount : row.amount
	if (amount < 0) {
		const stated = kind === "asset" ? "an asset" : "a liability"
		return fail("NEGATIVE_AMOUNT", {
			path,
			message: `${path}: ${account.name} holds ${formatMinorUnits(row.amount, row.currency)} ${row.currency}, which is negative once stated as ${stated}`,
			details: {
				account: { id: account.id, name: account.name },
				kind,
				currency: row.currency,
				ledgerAmount: formatMinorUnits(row.amount, row.currency),
				baselineAmount: formatMinorUnits(amount, row.currency),
			},
		})
	}
	return { account: { id: account.id, name: account.name }, kind, amount }
}

function map(ledger: Ledger, asOf: ISODate): BaselineMapping | AppError {
	let rows: readonly BalanceRow[]
	try {
		rows = balances(ledger.transactions, asOf, ledger.chart)
	} catch (error) {
		if (!(error instanceof LedgerValidationError)) throw error
		return ledgerFailure(error, fieldPath(error.field))
	}
	const mapped: MappedBalance[] = []
	for (const row of rows) {
		const one = mappedOf(row, ledger.accounts)
		if (isAppError(one)) return one
		if (one !== undefined) mapped.push(one)
	}
	return {
		document: {
			schemaVersion: 1,
			balances: mapped.map(({ account, amount }) => ({ account: account.id, amount })),
		},
		balances: mapped,
	}
}

/**
 * The Baseline mapping: the one function that knows both models. It reads no clock, opens no
 * database, formats nothing, and takes the Ledger exactly as `Store.ledger()` assembled it, so
 * the Transactions are validated once. `#11`'s `projection run` calls this same function.
 */
export function baselineOf(ledger: Ledger, asOf: string): BaselineMapping | AppError {
	const checked = checkedAsOf(asOf)
	if (isAppError(checked)) return checked
	return map(ledger, checked)
}
