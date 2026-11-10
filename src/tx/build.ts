import { openingBalance } from "@trajectonomics/ledger"
import { type AppError, isAppError } from "../errors"
import type { NewTransaction, Store } from "../store"
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
