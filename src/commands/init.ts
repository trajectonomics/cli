import { Database } from "bun:sqlite"
import { existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import type { Leaf } from "../command"
import { defineCommand, ok } from "../command"
import { dataDirectory } from "../data-directory"

export const init: Leaf = defineCommand({
	name: "init",
	summary: "Create the data directory and an empty database",
	positionals: [],
	input: z.strictObject({}),
	output: z.strictObject({
		directory: z.string().describe("The data directory."),
		database: z.string().describe("The path of traj.db."),
		created: z.boolean().describe("True when this run created the database."),
	}),
	examples: [
		{ command: "traj init", description: "Create ~/.traj/traj.db if it does not exist." },
		{ command: "TRAJ_HOME=/tmp/traj traj init --json", description: "Use another directory." },
	],
	errorCodes: [],
	run: (_input, ctx) => {
		const directory = dataDirectory(ctx.env)
		const database = join(directory, "traj.db")
		const created = !existsSync(database)
		mkdirSync(directory, { recursive: true })
		// Deliberately an empty database at `user_version` 0: the first `openStore()` migrates it
		// to head, so `init` never needs to know the schema. Setting WAL on a database that already
		// has it is a no-op, so a half-finished earlier run is repaired.
		const db = new Database(database, { create: true })
		db.run("PRAGMA journal_mode = WAL")
		db.close()
		return ok({ directory, database, created })
	},
})
