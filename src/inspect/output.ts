import { z } from "zod"
import { dumpRowSchema } from "../dump/schema"
import { DUMP_TABLES, type DumpRows, type DumpTable } from "../dump/view"
import { FIELDS } from "../interchange/format"
import type { ColumnHint, RenderHint } from "../table"
import { RIGHT_ALIGNED } from "../table"

/** One table in `inspect`'s result: its name, its row count, and its rows when it is a detail. */
export type InspectTable = {
	name: DumpTable
	count: number
	rows?: DumpRows[DumpTable] | undefined
}

/** The bare summary lists every table's name and count; a detail adds that table's rows. */
export type InspectOutput = { tables: InspectTable[] }

function entry<T extends DumpTable>(name: T) {
	return z.strictObject({
		name: z.literal(name).describe(`The ${name} table.`),
		count: z
			.number()
			.int()
			.describe("Every row in the table, tombstones included; equal to rows.length in a detail."),
		rows: z
			.array(dumpRowSchema[name])
			.optional()
			.describe("Every row, tombstones included. Absent from the bare summary."),
	})
}

/**
 * `{ tables: [{ name, count, rows? }] }`, the same shape for one table, for `--all` and for the
 * bare summary. The entry is a discriminated union on `name`, so `traj schema inspect` publishes
 * each table's row schema.
 */
export const inspectOutput: z.ZodType<InspectOutput> = z.strictObject({
	tables: z
		.array(
			z.discriminatedUnion("name", [
				entry("entity"),
				entry("account"),
				entry("tx"),
				entry("posting"),
				entry("scenario"),
			]),
		)
		.describe("One entry per table shown, in record order."),
})

function columnsOf(table: DumpTable): readonly ColumnHint[] {
	return Object.keys(FIELDS[table]).map((key) => ({
		key,
		label: key,
		align: RIGHT_ALIGNED.has(key) ? "right" : "left",
	}))
}

/** Every column of every table, in the writer's declared order, under the row's own key. */
export const inspectHint: RenderHint = {
	tables: "tables",
	rows: "rows",
	columns: Object.fromEntries(DUMP_TABLES.map((table) => [table, columnsOf(table)])),
}
