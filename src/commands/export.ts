import { z } from "zod"
import type { Leaf } from "../command"
import { defineCommand, ok } from "../command"
import { isAppError } from "../errors"
import { EXPORT_FORMATS } from "../export/files"
import { exportOutput } from "../export/output"
import { writeDumpExport } from "../export/run"

export const exportCommand: Leaf = defineCommand({
	name: "export",
	summary: "Write the stored rows into a new directory",
	positionals: [],
	input: z.strictObject({
		format: z
			.enum(EXPORT_FORMATS)
			.default("jsonl")
			.describe("The file format to write: jsonl, csv or md."),
		out: z.string().min(1).describe("A directory to create; it must not already exist."),
	}),
	output: exportOutput,
	examples: [
		{ command: "traj export --out backup", description: "Write the canonical JSONL dump." },
		{
			command: "traj export --format jsonl --out backup --json",
			description: "Describe what was written, per table.",
		},
	],
	// Opening a fresh or older database creates or migrates it, like every command (ADR-0014).
	errorCodes: [
		"output_exists",
		"export_failed",
		"database_busy",
		"database_too_new",
		"migration_failed",
	],
	run: async (input, ctx) => {
		const written = await writeDumpExport(ctx, input.format, input.out, "export")
		return isAppError(written) ? written : ok({ format: input.format, ...written })
	},
})
