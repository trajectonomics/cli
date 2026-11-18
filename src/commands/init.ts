import { z } from "zod"
import type { Leaf } from "../command"
import { defineCommand, ok } from "../command"
import { isAppError } from "../errors"
import { createLedger } from "../store/ledger-file"

export const init: Leaf = defineCommand({
	name: "init",
	summary: "Create an empty ledger; only restore may also create one",
	positionals: [],
	input: z.strictObject({}),
	output: z.strictObject({
		directory: z.string().describe("The data directory, created 0700."),
		database: z.string().describe("The path of traj.db, created 0600."),
		created: z.boolean().describe("True when this run created the database."),
	}),
	examples: [
		{ command: "traj init", description: "Create ~/.traj/traj.db if it does not exist." },
		{ command: "TRAJ_HOME=/tmp/traj traj init --json", description: "Use another directory." },
	],
	errorCodes: ["database_corrupt", "disk_full", "not_a_directory", "permission_denied"],
	run: (_input, ctx) => {
		const ledger = createLedger(ctx.env)
		return isAppError(ledger) ? ledger : ok(ledger)
	},
})
