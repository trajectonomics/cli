import { openingBalance } from "@trajectonomics/ledger"
import { type AppError, fail, isAppError } from "../errors"
import { type AccountRow, formatMinorUnits, type NewTransaction, type Store } from "../store"
import type { TransactionDocument } from "./document"
import { buildDocument } from "./document-build"
import { DRAFT_ID, identity, preparedTransfer, rewrite, written } from "./legs"
import { buildSimple } from "./simple"

/** The flag surface of `tx add`; all of it is also a field of the command's input schema. */
export type FlagInput = {
	from: string
	to: string
	amount: string
	date: string
	opening?: boolean | undefined
	project?: string | undefined
	memo?: string | undefined
	externalRef?: string | undefined
	dryRun?: boolean | undefined
	postings?: string | undefined
}

/**
 * A liability's Balance is credit-negative (GLOSSARY: Balance, Net worth), so the opening that
 * states a debt is negative and a positive one states a claim instead. It is refused rather than
 * flipped: the core states that an opening's direction is never inferred, and a silent flip would
 * move money the caller never typed.
 */
function refusePositiveLiability(account: AccountRow, amount: number): AppError | null {
	if (account.type !== "liability" || amount <= 0) return null
	const stated = formatMinorUnits(amount, account.currency)
	const owed = formatMinorUnits(-amount, account.currency)
	return fail("liability_opening_positive", {
		path: "--amount",
		message: `"${account.name}" is a liability: enter the debt as a negative amount.`,
		hint: `The amount is signed, so ${stated} in debt is --amount ${owed}.`,
		details: {
			account: { id: account.id, name: account.name },
			type: account.type,
			amount: stated,
			suggestedAmount: owed,
		},
	})
}

/** Builds either flag form: a simple magnitude transfer, or a signed opening balance. */
export function buildFlags(input: FlagInput, store: Store): NewTransaction | AppError {
	if (input.opening !== true) return buildSimple(input, store)
	const parts = preparedTransfer(input, store, identity)
	if (isAppError(parts)) return parts
	const { from, to, chart, amount, dimensions } = parts
	try {
		const built = openingBalance(
			{
				id: DRAFT_ID,
				date: input.date,
				account: { accountId: to.id, ...dimensions },
				contra: { accountId: from.id, ...dimensions },
				amount,
			},
			chart,
		)
		// Checked after the core accepted the shape, so the core's own refusals — a header
		// account, a currency mismatch — are the ones a caller meets first.
		const refused = refusePositiveLiability(to, amount)
		if (refused !== null) return refused
		return written(built, input)
	} catch (error) {
		return rewrite(error, { account: "to", contra: "from" }, identity)
	}
}

/** The transaction a leaf's write input asked for: the flag form unless a document was named. */
export function buildTransaction(
	input: FlagInput,
	document: TransactionDocument | undefined,
	store: Store,
): NewTransaction | AppError {
	return document === undefined ? buildFlags(input, store) : buildDocument(document, store)
}
