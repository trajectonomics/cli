import { z } from "zod"
import { UUID_SHAPED } from "../../account/name"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { missingFieldError } from "../../document"
import { fail, isAppError } from "../../errors"
import { DOCUMENT, exclusive, REQUIRED_NAME } from "../../scenario/apply-forms"
import { invalidScenarioName } from "../../scenario/errors"
import { scenarioTemplate } from "../../scenario/template"
import { view, type WrittenScenario, writtenScenario } from "../../scenario/view"
import { withStore } from "../../with-store"

const result = z.strictObject({
	dryRun: z.boolean().describe("True when the write was rolled back."),
	status: z.enum(["created", "updated", "unchanged"]).describe("What the apply found."),
	scenario: writtenScenario,
})

export const apply: Leaf = defineCommand({
	name: "apply",
	summary: "Create or update a Scenario from a JSON document",
	positionals: ["name"],
	input: z.strictObject({
		name: z
			.string()
			.min(1)
			.optional()
			.describe("The Scenario's name; exact, case-sensitive and not shaped like a UUID."),
		file: z
			.string()
			.min(1)
			.optional()
			.describe("The JSON document's path, or - for stdin; --template prints one to start from."),
		template: z
			.boolean()
			.optional()
			.describe("Print a minimal document to start from and open no data directory."),
		dryRun: z.boolean().optional().describe("Report the row and roll the write back."),
	}),
	document: DOCUMENT,
	output: z.union([z.string(), result]),
	examples: [
		{
			command: "traj scenario apply --template",
			description: "Print a minimal document to start from.",
		},
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
		const wrong = exclusive(input)
		if (wrong !== undefined) return wrong
		if (input.template === true) {
			// Text only: it returns before `withStore`, so it opens no data directory. Nothing names
			// `--file`, so no document and no stdin is read either.
			const template = scenarioTemplate()
			return template === undefined ? fail("internal") : ok(template)
		}
		// The document form checks this before it reads the document; the guard keeps `name` a string.
		const name = input.name
		if (name === undefined) return missingFieldError(REQUIRED_NAME)
		if (UUID_SHAPED.test(name)) return invalidScenarioName()
		const dryRun = input.dryRun === true
		return withStore(ctx, (store) => {
			const outcome = store.saveScenario({ name, document }, { dryRun })
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
