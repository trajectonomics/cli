import { z } from "zod"
import type { Leaf } from "../command"
import { defineCommand } from "../command"
import { isAppError } from "../errors"
import { independenceOf } from "../projection/fi"
import { fiView } from "../projection/fi-view"
import {
	asOfFlag,
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
	run: (input, ctx) =>
		withProjection(input, ctx, (prepare) => {
			const prepared = prepare({
				scenario: input.scenario,
				scenarioPath: "scenario",
				sets: input.set ?? [],
			})
			if (isAppError(prepared)) return prepared
			return independenceOf(prepared)
		}),
})
