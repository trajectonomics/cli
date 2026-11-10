import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { fail, isAppError } from "../../errors"
import { scenarioNotFound } from "../../scenario/errors"
import { scenarioView, view } from "../../scenario/view"
import { withStore } from "../../with-store"

export const rm: Leaf = defineCommand({
	name: "rm",
	summary: "Tombstone a Scenario and free its name",
	positionals: ["scenario"],
	input: z.strictObject({
		scenario: z.string().describe("The Scenario's exact name or its id."),
		dryRun: z.boolean().optional().describe("Report the row and roll the write back."),
	}),
	output: z.strictObject({
		dryRun: z.boolean().describe("True when the write was rolled back."),
		status: z.literal("deleted").describe("The Scenario was tombstoned."),
		deletedAt: z.string().describe("When the tombstone was written."),
		scenario: scenarioView.describe("The row as it was, without its deletion field."),
	}),
	examples: [
		{ command: "traj scenario rm early", description: "Retire a Scenario by name." },
		{ command: "traj scenario rm early --dry-run", description: "Show what rm would do." },
	],
	errorCodes: ["database_busy", "not_found"],
	run: (input, ctx) =>
		withStore(ctx, (store) => {
			const row = store.getScenario(input.scenario)
			if (isAppError(row)) return row
			if (row === null) return scenarioNotFound(input.scenario)
			const dryRun = input.dryRun === true
			const outcome = store.deleteScenario(row.id, { dryRun })
			if (isAppError(outcome)) return outcome
			if (outcome.status === "not_found") return scenarioNotFound(input.scenario)
			const deletedAt = outcome.scenario.deletedAt
			if (deletedAt === null) return fail("internal")
			return ok({
				dryRun,
				status: "deleted" as const,
				deletedAt,
				scenario: view(outcome.scenario),
			})
		}),
})
