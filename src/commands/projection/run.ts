import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand } from "../../command"
import { isAppError } from "../../errors"
import {
	asOfFlag,
	horizonFlag,
	PROJECTION_ERROR_CODES,
	scenarioFlag,
	setFlag,
} from "../../projection/flags"
import { withProjection } from "../../projection/leaf"
import { projectionHint } from "../../projection/render"
import { projectionOf } from "../../projection/run"
import { projectionRunView } from "../../projection/run-view"

export const run: Leaf = defineCommand({
	name: "run",
	summary: "Project the Baseline through a Scenario, year by year",
	positionals: [],
	input: z.strictObject({
		asOf: asOfFlag,
		horizon: horizonFlag,
		scenario: scenarioFlag,
		set: setFlag,
		monthly: z.boolean().default(false).describe("Also report the monthly rows."),
	}),
	output: projectionRunView,
	render: projectionHint,
	examples: [
		{
			command: "traj projection run --scenario base --as-of 2026-03-31 --horizon 2027-03-30 --json",
			description: "The annual roll-up of one Scenario.",
		},
		{
			command:
				"traj projection run --scenario base --as-of 2026-03-31 --horizon 2027-03-30 --set flows.salary.amount=90000 --monthly",
			description: "Try a raise without forking, and read the monthly rows.",
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
			return projectionOf(prepared, input.monthly)
		}),
})
