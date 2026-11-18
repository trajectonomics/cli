import { z } from "zod"
import { backupOutput } from "../backup/output"
import type { Leaf } from "../command"
import { defineCommand, ok } from "../command"
import { isAppError } from "../errors"
import { writeDumpExport } from "../export/run"

export const backup: Leaf = defineCommand({
	name: "backup",
	summary: "Write the one file a restore reads into a new directory",
	positionals: [],
	input: z.strictObject({
		out: z.string().min(1).describe("A directory to create; it must not already exist."),
	}),
	output: backupOutput,
	examples: [
		{ command: "traj backup --out backup", description: "Write traj.jsonl, the restorable copy." },
		{
			command: "traj backup --out backup --json",
			description: "Describe the file written and its rows.",
		},
	],
	// The canonical JSONL export is a backup and nothing else is: CSV and Markdown do not restore.
	errorCodes: [
		"output_exists",
		"export_failed",
		"database_busy",
		"database_corrupt",
		"disk_full",
		"not_a_directory",
		"permission_denied",
		"database_too_new",
		"migration_failed",
	],
	run: async (input, ctx) => {
		const written = await writeDumpExport(ctx, "jsonl", input.out, "backup")
		return isAppError(written) ? written : ok(written)
	},
})
