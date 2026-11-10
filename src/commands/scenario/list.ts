import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { isAppError } from "../../errors"
import { scenarioSummary, summary } from "../../scenario/view"
import { withStore } from "../../with-store"

export const list: Leaf = defineCommand({
	name: "list",
	summary: "List the live Scenarios by name",
	positionals: [],
	input: z.strictObject({}),
	output: z.strictObject({
		scenarios: z.array(scenarioSummary).describe("Every live Scenario, ordered by name then id."),
	}),
	examples: [{ command: "traj scenario list --json", description: "Show the Scenarios as JSON." }],
	errorCodes: [],
	run: (_input, ctx) =>
		withStore(ctx, (store) => {
			const rows = store.listScenarios({ sort: "name" })
			return isAppError(rows) ? rows : ok({ scenarios: rows.map(summary) })
		}),
})
