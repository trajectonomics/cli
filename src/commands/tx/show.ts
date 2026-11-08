import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { type AppError, isAppError } from "../../errors"
import type { Store, TxRow } from "../../store"
import { transactionNotFound } from "../../tx/errors"
import {
	accountNames,
	readTransaction,
	refOf,
	type TransactionLinks,
	transactionLinks,
	transactionView,
} from "../../tx/read"
import { withStore } from "../../with-store"

function linksOf(store: Store, tx: TxRow): TransactionLinks | AppError {
	const corrects = tx.linkedTo === null ? null : store.getTransaction(tx.linkedTo)
	if (isAppError(corrects)) return corrects
	const correctedBy = store.listTransactions({ sort: "date", linkedTo: tx.id })
	if (isAppError(correctedBy)) return correctedBy
	return {
		corrects: corrects === null ? null : refOf(corrects),
		correctedBy: correctedBy.map(refOf),
	}
}

export const show: Leaf = defineCommand({
	name: "show",
	summary: "Show one transaction with its postings and corrections",
	positionals: ["id"],
	input: z.strictObject({ id: z.string().describe("The transaction's id.") }),
	output: z.strictObject({
		transaction: readTransaction,
		links: transactionLinks.describe("What this transaction corrects, and what corrects it."),
	}),
	examples: [
		{
			command: "traj tx show 01940000-0000-7000-8000-000000000000 --json",
			description: "Show a transaction by id.",
		},
	],
	errorCodes: ["not_found"],
	run: (input, ctx) =>
		withStore(ctx, (store) => {
			const tx = store.getTransaction(input.id)
			if (isAppError(tx)) return tx
			if (tx === null) return transactionNotFound(input.id)
			const postings = store.listPostings({ sort: "tx_id", filter: { id: tx.id } })
			if (isAppError(postings)) return postings
			const names = accountNames(store)
			if (isAppError(names)) return names
			const links = linksOf(store, tx)
			if (isAppError(links)) return links
			return ok({ transaction: transactionView(tx, postings, names), links })
		}),
})
