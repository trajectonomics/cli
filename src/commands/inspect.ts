import { z } from "zod"
import type { Leaf } from "../command"
import { defineCommand, ok } from "../command"
import { DUMP_TABLES, isDumpTable, viewDump } from "../dump/view"
import { type AppError, fail, isAppError } from "../errors"
import { inspectHint, inspectOutput } from "../inspect/output"
import { withStore } from "../with-store"

function unknownTable(table: string): AppError {
	const singular = table.endsWith("s") ? table.slice(0, -1) : table
	const suggestion = isDumpTable(singular) ? ` Did you mean "${singular}"?` : ""
	return fail("invalid_input", {
		path: "table",
		message: `Unknown table: ${table}.${suggestion}`,
		hint: `Valid tables: ${DUMP_TABLES.join(", ")}.`,
		details: { tables: [...DUMP_TABLES] },
	})
}

export const inspect: Leaf = defineCommand({
	name: "inspect",
	summary: "Show the stored rows of one table, or of every table",
	positionals: ["table"],
	input: z.strictObject({
		table: z
			.string()
			.optional()
			.describe("One table to show: entity, account, tx, posting or scenario."),
		all: z.boolean().default(false).describe("Show every table, in record order."),
	}),
	output: inspectOutput,
	render: inspectHint,
	examples: [
		{ command: "traj inspect account", description: "Show every stored Account row." },
		{ command: "traj inspect --all", description: "Show every table's rows in record order." },
		{ command: "traj inspect --json", description: "Show each table's name and row count." },
	],
	// Opening a fresh or older database creates or migrates it, like every command (ADR-0014).
	errorCodes: ["invalid_input", "database_busy", "database_too_new", "migration_failed"],
	run: (input, ctx) => {
		if (input.all && input.table !== undefined) {
			return fail("invalid_input", {
				path: "all",
				message: "--all takes no table name.",
				hint: "Name one table to show that table, or pass --all alone to show every table.",
			})
		}
		if (input.table !== undefined && !isDumpTable(input.table)) return unknownTable(input.table)
		const table = input.table
		return withStore(ctx, (store) => {
			if (table === undefined && !input.all) {
				// The summary reads one statement of counts, never every row.
				const counts = store.counts()
				if (isAppError(counts)) return counts
				return ok({ tables: DUMP_TABLES.map((name) => ({ name, count: counts[name] })) })
			}
			const rows = store.dump()
			if (isAppError(rows)) return rows
			const view = viewDump(rows)
			const shown = table === undefined ? [...DUMP_TABLES] : [table]
			return ok({
				tables: shown.map((name) => ({ name, count: view[name].length, rows: view[name] })),
			})
		})
	},
})
