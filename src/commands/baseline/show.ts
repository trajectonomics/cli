import { z } from "zod"
import { baselineShow } from "../../baseline/show"
import { baselineShow as resultSchema } from "../../baseline/view"
import type { Leaf } from "../../command"
import { defineCommand } from "../../command"
import { LEDGER_READ_CODES } from "../../store"

export const show: Leaf = defineCommand({
	name: "show",
	summary: "Show the Baseline a Projection starts from at a date",
	positionals: [],
	input: z.strictObject({
		asOf: z.string().describe("The date the Baseline is stated at, as YYYY-MM-DD."),
	}),
	output: resultSchema,
	examples: [
		{
			command: "traj baseline show --as-of 2026-03-31 --json",
			description: "The Baseline a Projection would start from at one date.",
		},
	],
	errorCodes: [
		"INVALID_DATE",
		"NEGATIVE_AMOUNT",
		"AMOUNT_OVERFLOW",
		"unsupported_currency",
		...LEDGER_READ_CODES,
	],
	run: (input, ctx) => baselineShow(ctx, input.asOf),
})
