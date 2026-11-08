import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { isAppError } from "../../errors"
import { transactionNotFound } from "../../tx/errors"
import { viewTransaction, type WrittenTransaction, writtenTransactionSchema } from "../../tx/view"
import { withStore } from "../../with-store"

const voidedTransaction: z.ZodType<WrittenTransaction<"voided" | "already_corrected">> =
	writtenTransactionSchema(["voided", "already_corrected"], "What the void found.")

export const voidTx: Leaf = defineCommand({
	name: "void",
	summary: "Reverse a transaction, keeping both rows",
	positionals: ["id"],
	input: z.strictObject({
		id: z.string().min(1).describe("The transaction's id."),
		date: z.string().describe("The reversal's YYYY-MM-DD date; it may not precede the original's."),
		dryRun: z.boolean().optional().describe("Report the reversal and roll the write back."),
	}),
	output: voidedTransaction,
	examples: [
		{
			command: "traj tx void 0194a000-0003-7000-8000-000000000003 --date 2026-03-02",
			description: "Reverse a transaction by id.",
		},
		{
			command: "traj tx void 0194a000-0003-7000-8000-000000000003 --date 2026-03-02 --dry-run",
			description: "Show the reversal without writing it.",
		},
	],
	errorCodes: [
		"INVALID_ACCOUNT_HIERARCHY",
		"INVALID_AMOUNT",
		"CURRENCY_MISMATCH",
		"INVALID_CURRENCY",
		"INVALID_DATE",
		"INVALID_DIMENSION",
		"NON_LEAF_ACCOUNT",
		"SINGLE_POSTING",
		"UNBALANCED_TRANSACTION",
		"UNKNOWN_ACCOUNT",
		"ZERO_AMOUNT_POSTING",
		"DUPLICATE_TRANSACTION_ID",
		"REVERSAL_BEFORE_ORIGINAL",
		"account_archived",
		"database_busy",
		"not_found",
	],
	run: (input, ctx) =>
		withStore(ctx, (store) => {
			const dryRun = input.dryRun === true
			const outcome = store.voidTransaction(input.id, { date: input.date }, { dryRun })
			if (isAppError(outcome)) return outcome
			if (outcome.status === "not_found") return transactionNotFound(input.id)
			return ok(viewTransaction(outcome, dryRun))
		}),
})
