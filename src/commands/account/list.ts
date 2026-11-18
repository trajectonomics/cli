import { z } from "zod"
import { accountRow, view } from "../../account/view"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { isAppError } from "../../errors"
import { ACCOUNT_HINT, hintField } from "../../hint"
import { withStore } from "../../with-store"

export const list: Leaf = defineCommand({
	name: "list",
	summary: "List the chart of accounts by name",
	positionals: [],
	input: z.strictObject({}),
	output: z.strictObject({
		accounts: z.array(accountRow).describe("Every non-tombstoned account, archived included."),
		hint: z
			.string()
			.optional()
			.describe(
				"The command that fills the empty answer, present only when the Ledger is why it is empty.",
			),
	}),
	examples: [{ command: "traj account list --json", description: "Show the chart as JSON." }],
	errorCodes: [],
	run: (_input, ctx) =>
		withStore(ctx, (store) => {
			const accounts = store.listAccounts({ sort: "name" })
			if (isAppError(accounts)) return accounts
			return ok({
				accounts: accounts.map(view),
				...hintField(accounts.length === 0 ? ACCOUNT_HINT : undefined),
			})
		}),
})
