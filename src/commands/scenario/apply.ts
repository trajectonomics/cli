import { z } from "zod"
import { UUID_SHAPED } from "../../account/name"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { isAppError } from "../../errors"
import { scenarioDocument } from "../../scenario/envelope"
import { invalidScenarioName } from "../../scenario/errors"
import { view, type WrittenScenario, writtenScenario } from "../../scenario/view"
import { withStore } from "../../with-store"

export const apply: Leaf = defineCommand({
	name: "apply",
	summary: "Create or update a Scenario from a JSON document",
	positionals: ["name"],
	input: z.strictObject({
		name: z
			.string()
			.min(1)
			.describe("The Scenario's name; exact, case-sensitive and not shaped like a UUID."),
		file: z.string().min(1).describe("The JSON document's path, or - for stdin."),
		dryRun: z.boolean().optional().describe("Report the row and roll the write back."),
	}),
	document: { flag: "file", schema: scenarioDocument, allowed: ["name", "dryRun"] },
	output: z.strictObject({
		dryRun: z.boolean().describe("True when the write was rolled back."),
		status: z.enum(["created", "updated", "unchanged"]).describe("What the apply found."),
		scenario: writtenScenario,
	}),
	examples: [
		{
			command: "traj scenario apply base --file base.json",
			description: "Create a Scenario, or update it when the document changed.",
		},
		{
			command: "traj scenario apply base --file - < base.json",
			description: "Read the document from stdin.",
		},
		{
			command: "traj scenario apply base --file base.json --dry-run",
			description: "Show the row and roll the write back.",
		},
	],
	errorCodes: ["database_busy", "invalid_input"],
	run: (input, document, ctx) => {
		// The document is read and validated before `run`, so the name check comes after it.
		if (UUID_SHAPED.test(input.name)) return invalidScenarioName()
		const dryRun = input.dryRun === true
		return withStore(ctx, (store) => {
			const outcome = store.saveScenario({ name: input.name, document }, { dryRun })
			if (isAppError(outcome)) return outcome
			const rendered = view(outcome.scenario)
			const scenario: WrittenScenario = {
				...rendered,
				id: dryRun && outcome.status === "created" ? null : rendered.id,
			}
			return ok({ dryRun, status: outcome.status, scenario })
		})
	},
})
