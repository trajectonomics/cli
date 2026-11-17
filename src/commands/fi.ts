import { z } from "zod"
import type { Leaf } from "../command"
import { defineCommand } from "../command"
import { isAppError } from "../errors"
import { readCarryIn } from "../projection/carryin"
import { withCarryInSide } from "../projection/carryin-apply"
import { independenceOf } from "../projection/fi"
import { fiView } from "../projection/fi-view"
import {
	asOfFlag,
	carryInFlag,
	horizonFlag,
	PROJECTION_ERROR_CODES,
	scenarioFlag,
	setFlag,
} from "../projection/flags"
import { withProjection } from "../projection/leaf"

export const fi: Leaf = defineCommand({
	name: "fi",
	summary: "Report the financial independence date under a Scenario",
	positionals: [],
	input: z.strictObject({
		asOf: asOfFlag,
		horizon: horizonFlag,
		scenario: scenarioFlag,
		set: setFlag,
		carryIn: carryInFlag,
	}),
	output: fiView,
	examples: [
		{
			command: "traj fi --scenario base --as-of 2026-03-31 --horizon 2027-03-30 --json",
			description: "The survival FI date, with the 25x figure as a labelled reference.",
		},
		{
			command:
				"traj fi --scenario base --as-of 2026-03-31 --horizon 2027-03-30 --set flows.salary.amount=90000",
			description: "The same date under one changed assumption.",
		},
	],
	errorCodes: PROJECTION_ERROR_CODES,
	run: async (input, ctx) => {
		const records = input.carryIn === undefined ? [] : await readCarryIn(input.carryIn, ctx.stdin)
		if (isAppError(records)) return records
		return withProjection(input, ctx, (prepare) => {
			const prepared = prepare({
				scenario: input.scenario,
				scenarioPath: "scenario",
				sets: input.set ?? [],
			})
			if (isAppError(prepared)) return prepared
			const placed = withCarryInSide({ prepared, records, asOf: input.asOf })
			if (isAppError(placed)) return placed
			return independenceOf(placed)
		})
	},
})
