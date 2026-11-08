import type { Transaction } from "@trajectonomics/ledger"
import { LedgerValidationError, openingBalance, simple } from "@trajectonomics/ledger"
import { notFound } from "../account/errors"
import { type AppError, isAppError } from "../errors"
import {
	type AccountRow,
	fromLedgerError,
	type NewPosting,
	type NewTransaction,
	parseMinorUnits,
	type Store,
} from "../store"

/** The flag surface of `tx add`; all of it is also a field of the command's input schema. */
export type FlagInput = {
	from: string
	to: string
	amount: string
	date: string
	opening?: boolean | undefined
	project?: string | undefined
	externalRef?: string | undefined
	dryRun?: boolean | undefined
	postings?: string | undefined
}

// The core builder needs an id to shape a Transaction; the store mints the persisted one.
const DRAFT_ID = "01940000-0000-7000-8000-000000000000"

function account(store: Store, ref: string): AccountRow | AppError {
	const row = store.getAccount(ref)
	if (isAppError(row)) return row
	return row ?? notFound(ref)
}

function dimensionsOf(project: string | undefined): Pick<NewPosting, "dimensions"> | object {
	return project === undefined ? {} : { dimensions: { project } }
}

function postingsOf(tx: Transaction): NewPosting[] {
	return tx.postings.map((posting) => ({
		accountId: posting.accountId,
		amount: posting.amount,
		currency: posting.currency,
		...(posting.dimensions === undefined ? {} : { dimensions: posting.dimensions }),
	}))
}

/** `debit`/`credit` are the core's words; the envelope names the caller's flags instead. */
function rewrite(error: unknown, names: Record<string, string>): AppError {
	if (!(error instanceof LedgerValidationError)) throw error
	const [head = "", ...rest] = error.field.split(".")
	const field = [names[head] ?? head, ...rest].filter(Boolean).join(".")
	return fromLedgerError(new LedgerValidationError(error.code, field, error.value, error.reason))
}

function written(tx: Transaction, input: FlagInput): NewTransaction {
	const externalRef = input.externalRef === undefined ? {} : { externalRef: input.externalRef }
	return { date: input.date, postings: postingsOf(tx), ...externalRef }
}

/** Builds either flag form: a simple magnitude transfer, or a signed opening balance. */
export function buildFlags(input: FlagInput, store: Store): NewTransaction | AppError {
	const from = account(store, input.from)
	if (isAppError(from)) return from
	const to = account(store, input.to)
	if (isAppError(to)) return to
	const chart = store.chart()
	if (isAppError(chart)) return chart
	const amount = parseMinorUnits(input.amount, to.currency, "amount")
	if (isAppError(amount)) return amount
	const dimensions = dimensionsOf(input.project)
	const base = { id: DRAFT_ID, date: input.date }
	try {
		const built =
			input.opening === true
				? openingBalance(
						{
							...base,
							account: { accountId: to.id, ...dimensions },
							contra: { accountId: from.id, ...dimensions },
							amount,
						},
						chart,
					)
				: simple(
						{
							...base,
							debit: { accountId: to.id, ...dimensions },
							credit: { accountId: from.id, ...dimensions },
							amount,
						},
						chart,
					)
		return written(built, input)
	} catch (error) {
		return input.opening === true
			? rewrite(error, { account: "to", contra: "from" })
			: rewrite(error, { debit: "to", credit: "from" })
	}
}
