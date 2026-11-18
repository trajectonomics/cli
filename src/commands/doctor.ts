import { z } from "zod"
import type { Leaf } from "../command"
import { defineCommand, ok } from "../command"
import { doctorOf } from "../doctor/check"
import { doctorOutput } from "../doctor/output"
import { isAppError } from "../errors"

export const doctor: Leaf = defineCommand({
	name: "doctor",
	summary: "Check the data directory, the database and the ledger before anything goes wrong",
	positionals: [],
	input: z.strictObject({
		asOf: z
			.string()
			.optional()
			.describe("Add the Trial Balance at this date, as YYYY-MM-DD; it needs a date to be stated."),
	}),
	output: doctorOutput,
	examples: [
		{ command: "traj doctor", description: "Check the data directory and what it holds." },
		{
			command: "traj doctor --as-of 2026-11-30 --json",
			description: "Add the Trial Balance and describe every check.",
		},
	],
	// A check's finding is a result, not a failure (ADR-0038); only a bad --as-of is an input error.
	errorCodes: ["AMOUNT_OVERFLOW", "INVALID_DATE"],
	run: (input, ctx) => {
		const result = doctorOf(ctx, input.asOf)
		return isAppError(result) ? result : ok(result)
	},
})
