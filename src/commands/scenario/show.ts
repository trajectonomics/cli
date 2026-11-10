import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { isAppError } from "../../errors"
import { scenarioNotFound } from "../../scenario/errors"
import { scenarioView, view } from "../../scenario/view"
import { withStore } from "../../with-store"

export const show: Leaf = defineCommand({
	name: "show",
	summary: "Show one Scenario with its document",
	positionals: ["scenario"],
	input: z.strictObject({
		scenario: z.string().describe("The Scenario's exact name or its id."),
	}),
	output: z.strictObject({
		scenario: scenarioView,
	}),
	examples: [
		{ command: "traj scenario show base", description: "Show a Scenario by name." },
		{
			command: "traj scenario show base --json | jq .scenario.document",
			description: "Print only the document.",
		},
	],
	errorCodes: ["not_found"],
	run: (input, ctx) =>
		withStore(ctx, (store) => {
			const row = store.getScenario(input.scenario)
			if (isAppError(row)) return row
			if (row === null) return scenarioNotFound(input.scenario)
			return ok({ scenario: view(row) })
		}),
})
