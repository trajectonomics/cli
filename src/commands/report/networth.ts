import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand } from "../../command"
import { type NetWorthResult, netWorthOf } from "../../report/networth"
import { reportRow, totalView } from "../../report/view"
import { withLedger } from "../../report/with-ledger"
import { LEDGER_READ_CODES } from "../../store"

const resultSchema: z.ZodType<NetWorthResult> = z.strictObject({
	asOf: z.string().describe("The date the result is stated at, as YYYY-MM-DD."),
	rows: z
		.array(reportRow)
		.describe("The asset and liability Leaf Accounts behind the total, in `account list` order."),
	totals: z.array(totalView).describe("Assets minus liabilities, one entry per currency."),
})

export const networth: Leaf = defineCommand({
	name: "networth",
	summary: "Show the assets and liabilities behind net worth at a date",
	positionals: [],
	input: z.strictObject({
		asOf: z.string().describe("The date the result is stated at, as YYYY-MM-DD."),
	}),
	output: resultSchema,
	examples: [
		{
			command: "traj report networth --as-of 2026-03-31 --json",
			description: "The asset and liability balances that make up net worth.",
		},
	],
	errorCodes: ["INVALID_DATE", "AMOUNT_OVERFLOW", ...LEDGER_READ_CODES],
	run: (input, ctx) => withLedger(ctx, (ledger) => netWorthOf(ledger, input.asOf)),
})
