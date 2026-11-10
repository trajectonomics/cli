import type { ChartOfAccounts, Transaction } from "@trajectonomics/ledger"
import { LedgerValidationError } from "@trajectonomics/ledger"
import { type AppError, isAppError } from "../errors"
import {
	type AccountRow,
	fromLedgerError,
	type NewPosting,
	type NewTransaction,
	parseMinorUnits,
	type Store,
} from "../store"
import { unknownAccount } from "./errors"

/** Names the input field a failure points at; a CSV row prefixes its own line. */
export type FieldPath = (field: string) => string

/** `tx add`'s own paths, unchanged: the caller's flag names. */
export const identity: FieldPath = (field) => field

// The core builder needs an id to shape a Transaction, but this draft id is never persisted:
// the store mints the real UUIDv7 once, inside the write transaction.
export const DRAFT_ID = "01940000-0000-7000-8000-000000000000"

export function dimensionsOf(project: string | undefined): Pick<NewPosting, "dimensions"> | object {
	return project === undefined ? {} : { dimensions: { project } }
}

export function postingsOf(tx: Transaction): NewPosting[] {
	return tx.postings.map((posting) => ({
		accountId: posting.accountId,
		amount: posting.amount,
		currency: posting.currency,
		...(posting.dimensions === undefined ? {} : { dimensions: posting.dimensions }),
	}))
}

/** The core's `debit`/`credit` are its own words; the envelope names the caller's fields. */
export function rewrite(error: unknown, names: Record<string, string>, path: FieldPath): AppError {
	if (!(error instanceof LedgerValidationError)) throw error
	const [head = "", ...rest] = error.field.split(".")
	const field = [names[head] ?? path(head), ...rest].filter(Boolean).join(".")
	return fromLedgerError(new LedgerValidationError(error.code, field, error.value, error.reason))
}

/** The row to write: what the core built, plus the fields the core does not carry. */
export function written(
	tx: Transaction,
	input: { date: string; memo?: string | undefined; externalRef?: string | undefined },
): NewTransaction {
	const memo = input.memo === undefined ? {} : { memo: input.memo }
	const externalRef = input.externalRef === undefined ? {} : { externalRef: input.externalRef }
	return { date: input.date, postings: postingsOf(tx), ...memo, ...externalRef }
}

/** What a transfer names before it is built. */
export type Transfer = {
	from: string
	to: string
	amount: string
	date: string
	project?: string | undefined
	memo?: string | undefined
	externalRef?: string | undefined
}

/** Both sides resolved, the chart read and the magnitude parsed; the first failure wins. */
export type Prepared = {
	from: AccountRow
	to: AccountRow
	chart: ChartOfAccounts
	amount: number
	dimensions: ReturnType<typeof dimensionsOf>
}

export function preparedTransfer(
	input: Transfer,
	store: Store,
	path: FieldPath,
): Prepared | AppError {
	const from = store.getAccount(input.from)
	if (isAppError(from)) return from
	if (from === null) return unknownAccount(input.from, path("from"))
	const to = store.getAccount(input.to)
	if (isAppError(to)) return to
	if (to === null) return unknownAccount(input.to, path("to"))
	const chart = store.chart()
	if (isAppError(chart)) return chart
	const amount = parseMinorUnits(input.amount, to.currency, path("amount"))
	if (isAppError(amount)) return amount
	return { from, to, chart, amount, dimensions: dimensionsOf(input.project) }
}
