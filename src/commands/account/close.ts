import { z } from "zod"
import { notFound } from "../../account/errors"
import { withStore } from "../../account/store"
import { accountRow, view } from "../../account/view"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { isAppError } from "../../errors"

export const close: Leaf = defineCommand({
	name: "close",
	summary: "Archive an account, keeping its history",
	positionals: ["account"],
	input: z.strictObject({
		account: z.string().describe("The account's exact name or its id."),
		dryRun: z.boolean().optional().describe("Report the row and roll the write back."),
	}),
	output: z.strictObject({
		dryRun: z.boolean().describe("True when the write was rolled back."),
		status: z.enum(["archived", "already_archived"]).describe("What the close found."),
		account: accountRow,
	}),
	examples: [
		{ command: "traj account close Cash", description: "Archive an account by name." },
		{ command: "traj account close Cash --dry-run", description: "Show what closing would do." },
	],
	errorCodes: ["database_busy", "not_found"],
	run: (input, ctx) =>
		withStore(ctx, (store) => {
			const account = store.getAccount(input.account)
			if (isAppError(account)) return account
			if (account === null) return notFound(input.account)
			const dryRun = input.dryRun === true
			const outcome = store.closeAccount(account.id, { dryRun })
			if (isAppError(outcome)) return outcome
			if (outcome.status === "not_found") return notFound(input.account)
			return ok({ dryRun, status: outcome.status, account: view(outcome.account) })
		}),
})
