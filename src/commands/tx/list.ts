import { z } from "zod"
import { notFound } from "../../account/errors"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { type AppError, isAppError } from "../../errors"
import type { Store, TxFilter } from "../../store"
import { accountNames, readTransaction, transactionView } from "../../tx/read"
import { withStore } from "../../with-store"

const inputSchema = z.strictObject({
	since: z.string().optional().describe("The earliest transaction date, inclusive, as YYYY-MM-DD."),
	until: z.string().optional().describe("The latest transaction date, inclusive, as YYYY-MM-DD."),
	account: z
		.string()
		.min(1)
		.optional()
		.describe("An account's exact name or its id; a posting on either side matches."),
	project: z
		.string()
		.min(1)
		.optional()
		.describe("A project dimension value; only the postings carrying it are returned."),
})

type Input = z.output<typeof inputSchema>

/** Turns the flags into a store filter; `--account` resolves to an id or fails as `not_found`. */
function filterOf(input: Input, store: Store): TxFilter | AppError {
	const filter: TxFilter = {}
	if (input.since !== undefined) filter.since = input.since
	if (input.until !== undefined) filter.until = input.until
	if (input.account !== undefined) {
		const account = store.getAccount(input.account)
		if (isAppError(account)) return account
		if (account === null) return notFound(input.account)
		filter.accountId = account.id
	}
	if (input.project !== undefined) filter.project = input.project
	return filter
}

export const list: Leaf = defineCommand({
	name: "list",
	summary: "List transactions by date",
	positionals: [],
	input: inputSchema,
	output: z.strictObject({
		transactions: z
			.array(readTransaction)
			.describe("The matching transactions, oldest first and then by id, with their postings."),
	}),
	examples: [
		{ command: "traj tx list --json", description: "Read the whole ledger as JSON." },
		{
			command: "traj tx list --since 2026-01-01 --until 2026-03-31",
			description: "Read one inclusive date range.",
		},
		{
			command: "traj tx list --account Cash --project lunch",
			description: "Read the postings of one project that touched Cash.",
		},
	],
	errorCodes: ["not_found"],
	run: (input, ctx) =>
		withStore(ctx, (store) => {
			const filter = filterOf(input, store)
			if (isAppError(filter)) return filter
			const txs = store.listTransactions({ sort: "date", ...filter })
			if (isAppError(txs)) return txs
			const postings = store.listPostings({ sort: "tx_id" })
			if (isAppError(postings)) return postings
			const names = accountNames(store)
			if (isAppError(names)) return names
			const byTx = Map.groupBy(postings, (posting) => posting.txId)
			const project = input.project
			const postingsOf = (txId: string) => {
				const all = byTx.get(txId) ?? []
				return project === undefined
					? all
					: all.filter((posting) => posting.dimensions?.["project"] === project)
			}
			return ok({
				transactions: txs.map((tx) => transactionView(tx, postingsOf(tx.id), names)),
			})
		}),
})
