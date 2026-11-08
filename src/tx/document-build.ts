import { type AppError, isAppError } from "../errors"
import {
	type NewPosting,
	type NewTransaction,
	parseMinorUnits,
	type Store,
	supportedCurrency,
} from "../store"
import type { DocumentPosting, TransactionDocument } from "./document"
import { unknownAccount } from "./errors"

/** One document posting: resolve its account, check its currency, and parse its amount exactly. */
function postingOf(store: Store, posting: DocumentPosting, index: number): NewPosting | AppError {
	const path = `postings.${index}`
	const account = store.getAccount(posting.account)
	if (isAppError(account)) return account
	if (account === null) return unknownAccount(posting.account, `${path}.account`)
	const currency = supportedCurrency(posting.currency, `${path}.currency`)
	if (currency !== null) return currency
	const amount = parseMinorUnits(posting.amount, posting.currency, `${path}.amount`)
	if (isAppError(amount)) return amount
	return {
		accountId: account.id,
		amount,
		currency: posting.currency,
		...(posting.dimensions === undefined ? {} : { dimensions: posting.dimensions }),
	}
}

/** The document is already validated; this resolves accounts and turns decimal strings into units. */
export function buildDocument(
	document: TransactionDocument,
	store: Store,
): NewTransaction | AppError {
	const postings: NewPosting[] = []
	for (const [index, posting] of document.postings.entries()) {
		const built = postingOf(store, posting, index)
		if (isAppError(built)) return built
		postings.push(built)
	}
	const memo = document.memo === undefined ? {} : { memo: document.memo }
	const externalRef =
		document.externalRef === undefined ? {} : { externalRef: document.externalRef }
	return { date: document.date, postings, ...memo, ...externalRef }
}
