import { resolve } from "node:path"
import { z } from "zod"
import type { Leaf } from "../command"
import { defineCommand, ok } from "../command"
import { viewDump } from "../dump/view"
import { isAppError } from "../errors"
import { EXPORT_FORMATS, exportFiles } from "../export/files"
import { exportOutput } from "../export/output"
import { writeExport } from "../export/write"
import { withStore } from "../with-store"

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
		// Read the dump inside the store, then close it before writing anything.
		const read = withStore(ctx, (store) => {
			const schemaVersion = store.schemaVersion()
			if (isAppError(schemaVersion)) return schemaVersion
			const rows = store.dump()
			if (isAppError(rows)) return rows
			return ok({ schemaVersion, rows })
		})
		if (isAppError(read)) return read
		const { schemaVersion, rows } = read.data
		const view = viewDump(rows)
		const files = exportFiles(input.format, schemaVersion, view)
		const failure = await writeExport(input.out, files)
		if (failure) return failure
		return ok({
			format: input.format,
			directory: resolve(input.out),
			schemaVersion,
			files: files.map((file) => file.name),
			rows: {
				entity: view.entity.length,
				account: view.account.length,
				tx: view.tx.length,
				posting: view.posting.length,
				scenario: view.scenario.length,
			},
		})
	},
})
