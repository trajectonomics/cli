import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { isAppError } from "../../errors"
import { buildFlags } from "../../tx/build"
import { transactionDocument } from "../../tx/document"
import { buildDocument } from "../../tx/document-build"
import { viewTransaction, writtenTransaction } from "../../tx/view"
import { withStore } from "../../with-store"

export const add: Leaf = defineCommand({
	name: "add",
	summary: "Record a transaction",
	positionals: [],
	input: z.strictObject({
		from: z.string().min(1).describe("The source account's exact name or id."),
		to: z.string().min(1).describe("The destination account's exact name or id."),
		amount: z.string().describe("A magnitude in the accounts' currency, as a decimal string."),
		date: z
			.string()
			.describe(
				"The transaction's YYYY-MM-DD date; the core rejects an impossible date as INVALID_DATE.",
			),
		opening: z.boolean().optional().describe("Read --from as equity and --amount as signed."),
		project: z.string().min(1).optional().describe("Tag every posting with this project."),
		externalRef: z
			.string()
			.min(1)
			.optional()
			.describe("An idempotency key; replaying it is a duplicate."),
		dryRun: z.boolean().optional().describe("Report the transaction and roll the write back."),
		postings: z
			.string()
			.min(1)
			.optional()
			.describe("Read a JSON transaction document from this path, or - for stdin."),
	}),
	document: { flag: "postings", schema: transactionDocument, allowed: ["dryRun"] },
	output: writtenTransaction,
	examples: [
		{
			command: "traj tx add --from Cash --to Food --amount 120.50 --date 2026-03-01",
			description: "Record a purchase from Cash.",
		},
		{
			command: "traj tx add --opening --from Opening --to Cash --amount -25.00 --date 2026-01-01",
			description: "Open an overdrawn asset.",
		},
		{
			command: "traj tx add --postings -",
			description: "Read a multi-posting transaction document from stdin.",
		},
	],
	errorCodes: [
		"INVALID_ACCOUNT_HIERARCHY",
		"INVALID_AMOUNT",
		"CURRENCY_MISMATCH",
		"INVALID_CURRENCY",
		"INVALID_DATE",
		"INVALID_DIMENSION",
		"NEGATIVE_AMOUNT",
		"NON_EQUITY_CONTRA",
		"NON_LEAF_ACCOUNT",
		"SINGLE_POSTING",
		"UNBALANCED_TRANSACTION",
		"UNKNOWN_ACCOUNT",
		"ZERO_AMOUNT_POSTING",
		"account_archived",
		"database_busy",
		"external_ref_conflict",
		"invalid_input",
		"unsupported_currency",
	],
	run: (input, document, ctx) =>
		withStore(ctx, (store) => {
			const built =
				document === undefined ? buildFlags(input, store) : buildDocument(document, store)
			if (isAppError(built)) return built
			const dryRun = input.dryRun === true
			const outcome = store.addTransaction(built, { dryRun })
			if (isAppError(outcome)) return outcome
			return ok(viewTransaction(outcome.tx, outcome.postings, { dryRun, status: outcome.status }))
		}),
})
