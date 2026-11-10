import { simple } from "@trajectonomics/ledger"
import { type AppError, isAppError } from "../errors"
import type { NewTransaction, Store } from "../store"
import {
	DRAFT_ID,
	type FieldPath,
	identity,
	preparedTransfer,
	rewrite,
	type Transfer,
	written,
} from "./legs"

/** What one simple two-posting transfer needs; the flag form and a CSV row both supply it. */
export type SimpleInput = Transfer

/**
 * Builds one simple transfer, naming a failure at `path`. The import row calls it with a
 * `line.N.` prefix, so the row's error points at the CSV column the user must edit.
 */
export function buildSimple(
	input: SimpleInput,
	store: Store,
	path: FieldPath = identity,
): NewTransaction | AppError {
	const parts = preparedTransfer(input, store, path)
	if (isAppError(parts)) return parts
	const { from, to, chart, amount, dimensions } = parts
	try {
		const built = simple(
			{
				id: DRAFT_ID,
				date: input.date,
				debit: { accountId: to.id, ...dimensions },
				credit: { accountId: from.id, ...dimensions },
				amount,
			},
			chart,
		)
		return written(built, input)
	} catch (error) {
		return rewrite(error, { debit: path("to"), credit: path("from") }, path)
	}
}
