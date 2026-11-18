import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand } from "../../command"
import { type AppError, fail, isAppError } from "../../errors"
import { type CarryInRecordForm, readCarryIn } from "../../projection/carryin"
import { withCarryIn } from "../../projection/carryin-apply"
import { compareOf } from "../../projection/compare"
import { ageFlag, agesProblem, whatIfProblem } from "../../projection/compare-flags"
import { type CompareView, compareView } from "../../projection/compare-view"
import {
	asOfFlag,
	carryInFlag,
	carryInFlagDocument,
	horizonFlag,
	PROJECTION_ERROR_CODES,
	setFlag,
} from "../../projection/flags"
import { type Prepare, withProjection } from "../../projection/leaf"

export const compare: Leaf = defineCommand({
	name: "compare",
	summary: "Compare two Projections, or one against a what-if, and report the deltas",
	positionals: ["a", "b"],
	input: z.strictObject({
		asOf: asOfFlag,
		horizon: horizonFlag,
		set: setFlag,
		carryIn: carryInFlag,
		a: z.string().describe("The first Scenario's exact name or its id."),
		b: z
			.string()
			.optional()
			.describe("The second Scenario's exact name or its id; omit it to use --set."),
		birthDate: z
			.string()
			.optional()
			.describe("The birth date the ages count from, as YYYY-MM-DD; needed with --age."),
		age: ageFlag,
	}),
	flagDocuments: [carryInFlagDocument],
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
	run: async (input, ctx) => {
		const records = input.carryIn === undefined ? [] : await readCarryIn(input.carryIn, ctx.stdin)
		if (isAppError(records)) return records
		const ages = input.age ?? []
		const problem = whatIfProblem(input.b, input.set ?? []) ?? agesProblem(ages, input.birthDate)
		if (problem !== null) return problem
		return withProjection(input, ctx, (prepare) => compared({ input, records, ages, prepare }))
	},
})

/** The flags one compare states, as the command's own input schema declares them. */
type CompareFlags = {
	a: string
	b?: string | undefined
	set?: readonly string[] | undefined
	birthDate?: string | undefined
	asOf: string
}

/** Both sides prepared and placed, then compared: a what-if reuses A's Scenario and its record. */
function compared(input: {
	input: CompareFlags
	records: readonly CarryInRecordForm[]
	ages: readonly number[]
	prepare: Prepare
}): CompareView | AppError {
	const { prepare } = input
	const a = prepare({ scenario: input.input.a, scenarioPath: "a", sets: [] })
	if (isAppError(a)) return a
	// The what-if applies the Overrides to A and is compared with A; a second Scenario is compared
	// as stored.
	const b =
		input.input.b === undefined
			? prepare({ scenario: input.input.a, scenarioPath: "a", sets: input.input.set ?? [] })
			: prepare({ scenario: input.input.b, scenarioPath: "b", sets: [] })
	if (isAppError(b)) return b
	const placed = withCarryIn({
		sides: [a, b],
		records: input.records,
		asOf: input.input.asOf,
		currency: a.currency,
	})
	if (isAppError(placed)) return placed
	const [sideA, sideB] = placed
	if (sideA === undefined || sideB === undefined) {
		return fail("internal", { message: "A compare prepared fewer than two sides." })
	}
	return compareOf({
		a: sideA,
		b: sideB,
		birthDate: input.input.birthDate ?? null,
		ages: input.ages,
	})
}
