import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand } from "../../command"
import { checkedDate } from "../../date"
import { type AppError, fail, isAppError } from "../../errors"
import { compareOf } from "../../projection/compare"
import { compareView } from "../../projection/compare-view"
import { asOfFlag, horizonFlag, PROJECTION_ERROR_CODES, setFlag } from "../../projection/flags"
import { withProjection } from "../../projection/leaf"

const age = z
	.number()
	.int()
	.min(0)
	.describe("An age to report net worth at; repeatable and needs --birth-date.")

/** Exactly one of the second Scenario and `--set` says what B is (ADR-0030). */
function whatIfProblem(b: string | undefined, sets: readonly string[]): AppError | null {
	if ((b === undefined) === (sets.length === 0)) {
		return fail("invalid_input", {
			path: "b",
			message: "compare needs exactly one of a second Scenario or --set.",
			hint: "Pass a second Scenario name, or --set to compare the first one with a what-if.",
		})
	}
	return null
}

export const compare: Leaf = defineCommand({
	name: "compare",
	summary: "Compare two Projections, or one against a what-if, and report the deltas",
	positionals: ["a", "b"],
	input: z.strictObject({
		asOf: asOfFlag,
		horizon: horizonFlag,
		set: setFlag,
		a: z.string().describe("The first Scenario's exact name or its id."),
		b: z
			.string()
			.optional()
			.describe("The second Scenario's exact name or its id; omit it to use --set."),
		birthDate: z
			.string()
			.optional()
			.describe("The birth date the ages count from, as YYYY-MM-DD; needed with --age."),
		age: z.array(age).optional().describe("An age to report net worth at; repeatable."),
	}),
	output: compareView,
	examples: [
		{
			command: "traj projection compare base early --as-of 2026-03-31 --horizon 2027-03-30 --json",
			description: "How two Scenarios differ in FI date, net worth and run-out.",
		},
		{
			command:
				"traj projection compare base --as-of 2026-03-31 --horizon 2027-03-30 --set flows.salary.amount=90000 --birth-date 1985-06-15 --age 45 --age 50",
			description: "A what-if against the base, with net worth at two ages.",
		},
	],
	errorCodes: PROJECTION_ERROR_CODES,
	run: (input, ctx) => {
		const sets = input.set ?? []
		const problem = whatIfProblem(input.b, sets)
		if (problem !== null) return problem
		const ages = input.age ?? []
		if (ages.length > 0 && input.birthDate === undefined) {
			return fail("invalid_input", {
				path: "age",
				message: "--age needs --birth-date to know which birthday to read.",
				hint: "Pass --birth-date YYYY-MM-DD beside --age.",
			})
		}
		if (input.birthDate !== undefined) {
			const birthDate = checkedDate(input.birthDate, "birthDate")
			if (isAppError(birthDate)) return birthDate
		}
		return withProjection(input, ctx, (prepare) => {
			const a = prepare({ scenario: input.a, scenarioPath: "a", sets: [] })
			if (isAppError(a)) return a
			// The what-if applies the Overrides to A and is compared with A; a second Scenario is
			// compared as stored.
			const b =
				input.b === undefined
					? prepare({ scenario: input.a, scenarioPath: "a", sets })
					: prepare({ scenario: input.b, scenarioPath: "b", sets: [] })
			if (isAppError(b)) return b
			return compareOf({ a, b, birthDate: input.birthDate ?? null, ages })
		})
	},
})
