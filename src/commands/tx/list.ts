import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand } from "../../command"
import { listOf } from "../../tx/listing"
import { readTransaction } from "../../tx/read"
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

export const list: Leaf = defineCommand({
	name: "list",
	summary: "List transactions by date",
	positionals: [],
	input: inputSchema,
	output: z.strictObject({
		transactions: z
			.array(readTransaction)
			.describe("The matching transactions, oldest first and then by id, with their postings."),
		hint: z
			.string()
			.optional()
			.describe(
				"The command that fills the empty answer, present only when the Ledger is why it is empty.",
			),
	}),
	examples: [
		{ command: "traj tx list --json", description: "Read the whole ledger as JSON." },
		{
			command: "traj tx list --since 2026-01-01 --until 2026-03-31",
			description: "Read one inclusive date range.",
		},
		{
			command: "traj tx list --account Cash --project lunch",
			description: "Transactions touching Cash, narrowed to their lunch postings.",
		},
	],
	errorCodes: ["INVALID_DATE", "INVALID_PERIOD", "not_found"],
	run: (input, ctx) => withStore(ctx, (store) => listOf(store, input)),
})
