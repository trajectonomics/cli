import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { isAppError } from "../../errors"
import { accountRow, view, withStore } from "./shared"

export const list: Leaf = defineCommand({
	name: "list",
	summary: "List the chart of accounts by name",
	positionals: [],
	input: z.strictObject({}),
	output: z.strictObject({
		accounts: z.array(accountRow).describe("Every non-tombstoned account, archived included."),
	}),
	examples: [{ command: "traj account list --json", description: "Show the chart as JSON." }],
	errorCodes: [],
	run: (_input, ctx) =>
		withStore(ctx, (store) => {
			const accounts = store.listAccounts({ sort: "name" })
			return isAppError(accounts) ? accounts : ok({ accounts: accounts.map(view) })
		}),
})
