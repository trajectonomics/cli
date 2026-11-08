import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { isAppError } from "../../errors"
import { viewAmendment, writtenAmendment } from "../../tx/amend-view"
import { buildFlags } from "../../tx/build"
import { transactionDocument } from "../../tx/document"
import { buildDocument } from "../../tx/document-build"
import { transactionNotFound } from "../../tx/errors"
import { withStore } from "../../with-store"

export const amend: Leaf = defineCommand({
	name: "amend",
	summary: "Reverse a transaction and record its replacement",
	positionals: ["id"],
	input: z.strictObject({
		id: z.string().min(1).describe("The transaction to correct, by id."),
		date: z.string().describe("The replacement's YYYY-MM-DD date."),
		voidDate: z
			.string()
			.optional()
			.describe("The reversal's YYYY-MM-DD date; it defaults to --date and may not precede it."),
		from: z.string().min(1).describe("The replacement's source account's exact name or id."),
		to: z.string().min(1).describe("The replacement's destination account's exact name or id."),
		amount: z.string().describe("A magnitude in the accounts' currency, as a decimal string."),
		opening: z.boolean().optional().describe("Read --from as equity and --amount as signed."),
		project: z
			.string()
			.min(1)
			.optional()
			.describe("Tag every replacement posting with this project."),
		externalRef: z
			.string()
			.min(1)
			.optional()
			.describe("The replacement's new idempotency key; the original's is a conflict."),
		dryRun: z.boolean().optional().describe("Report both rows and roll the write back."),
		postings: z
			.string()
			.min(1)
			.optional()
			.describe("Read a JSON transaction document for the replacement from this path, or -."),
	}),
	document: {
		flag: "postings",
		schema: transactionDocument,
		allowed: ["id", "voidDate", "dryRun"],
	},
	output: writtenAmendment,
	examples: [
		{
			command:
				"traj tx amend 0194a000-0003-7000-8000-000000000003 --from Cash --to Food --amount 100 --date 2026-03-02",
			description: "Reverse a transaction and record the corrected one.",
		},
		{
			command: "traj tx amend 0194a000-0003-7000-8000-000000000003 --postings -",
			description: "Read the replacement's postings from stdin.",
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
		"DUPLICATE_TRANSACTION_ID",
		"REVERSAL_BEFORE_ORIGINAL",
		"account_archived",
		"database_busy",
		"external_ref_conflict",
		"invalid_input",
		"not_found",
		"unsupported_currency",
	],
	run: (input, document, ctx) =>
		withStore(ctx, (store) => {
			const replacement =
				document === undefined ? buildFlags(input, store) : buildDocument(document, store)
			if (isAppError(replacement)) return replacement
			const dryRun = input.dryRun === true
			const outcome = store.amendTransaction(
				input.id,
				{ replacement, ...(input.voidDate === undefined ? {} : { voidDate: input.voidDate }) },
				{ dryRun },
			)
			if (isAppError(outcome)) return outcome
			if (outcome.status === "not_found") return transactionNotFound(input.id)
			return ok(viewAmendment(outcome, dryRun))
		}),
})
