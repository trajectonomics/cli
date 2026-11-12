import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand } from "../../command"
import { type PnlResult, pnlOf } from "../../report/pnl"
import { reportRow, totalView } from "../../report/view"
import { withLedger } from "../../report/with-ledger"
import { LEDGER_READ_CODES } from "../../store"

const resultSchema: z.ZodType<PnlResult> = z.strictObject({
	since: z.string().nullable().describe("The period's inclusive start date, or null."),
	until: z.string().describe("The period's inclusive end date, as YYYY-MM-DD."),
	project: z.string().nullable().describe("The Project this result was filtered to, or null."),
	rows: z.array(reportRow).describe("One row per income and expense Leaf Account."),
	totals: z.array(totalView).describe("Income minus expenses, one entry per currency."),
})

export const pnl: Leaf = defineCommand({
	name: "pnl",
	summary: "Report income minus expenses over a period",
	positionals: [],
	input: z.strictObject({
		until: z.string().describe("The period's inclusive end date, as YYYY-MM-DD."),
		since: z
			.string()
			.optional()
			.describe("The period's inclusive start date; omit to start at the ledger's beginning."),
		project: z
			.string()
			.min(1)
			.optional()
			.describe("Only postings carrying this exact project dimension value."),
	}),
	output: resultSchema,
	examples: [
		{
			command: "traj report pnl --until 2026-03-31 --json",
			description: "Income minus expenses from the ledger's beginning.",
		},
		{
			command: "traj report pnl --since 2026-01-01 --until 2026-03-31 --project venture",
			description: "One side venture's period.",
		},
	],
	errorCodes: ["INVALID_DATE", "INVALID_PERIOD", "AMOUNT_OVERFLOW", ...LEDGER_READ_CODES],
	run: (input, ctx) => withLedger(ctx, (ledger) => pnlOf(ledger, input)),
})
