import { z } from "zod"
import { UUID_SHAPED } from "../../account/name"
import type { Leaf, Result } from "../../command"
import { defineCommand, ok } from "../../command"
import { type AppError, isAppError } from "../../errors"
import { type ScenarioDocument, scenarioProblems } from "../../scenario/document"
import { invalidScenarioName, scenarioNameTaken, scenarioNotFound } from "../../scenario/errors"
import { applyOverrides } from "../../scenario/set-apply"
import { type AppliedOverride, documentFailure } from "../../scenario/set-error"
import { view, type WrittenScenario, writtenScenario } from "../../scenario/view"
import type { ForkOptions, ScenarioForked, ScenarioTransform } from "../../store"
import { withStore } from "../../with-store"

const appliedOverride = z.strictObject({
	path: z.string().describe("The dotted path, escaped and canonical."),
	value: z.unknown().describe("The JSON value the path was set to."),
})

type ForkResult = {
	dryRun: boolean
	status: "forked"
	overrides: AppliedOverride[]
	scenario: WrittenScenario
}

/** Applies the sets inside the store's write, and keeps their echo for the result. */
function transformFor(
	sets: readonly string[],
	echo: (overrides: AppliedOverride[]) => void,
): ScenarioTransform {
	return (document: ScenarioDocument) => {
		const applied = applyOverrides(document, sets)
		if (isAppError(applied)) return applied
		const [problem] = scenarioProblems(applied.document)
		if (problem !== undefined) return documentFailure(applied.overrides, problem, applied.document)
		echo(applied.overrides)
		return applied.document
	}
}

function reply(
	outcome: ScenarioForked | AppError,
	from: string,
	overrides: AppliedOverride[],
	dryRun: boolean,
): Result<ForkResult> | AppError {
	if (isAppError(outcome)) return outcome
	if (outcome.status === "not_found") return scenarioNotFound(from, "from")
	if (outcome.status === "name_taken") return scenarioNameTaken(outcome.scenario.id)
	const rendered = view(outcome.scenario)
	const scenario: WrittenScenario = { ...rendered, id: dryRun ? null : rendered.id }
	return ok({ dryRun, status: "forked", overrides, scenario })
}

export const fork: Leaf = defineCommand({
	name: "fork",
	summary: "Copy a Scenario under a new name",
	positionals: ["from", "name"],
	input: z.strictObject({
		from: z.string().min(1).describe("The source Scenario's exact name or its id."),
		name: z
			.string()
			.min(1)
			.describe("The copy's name; exact, case-sensitive and not shaped like a UUID."),
		set: z
			.array(z.string())
			.optional()
			.describe("Replace one existing dotted document path with a JSON value; repeatable."),
		dryRun: z.boolean().optional().describe("Report the row and roll the write back."),
	}),
	output: z.strictObject({
		dryRun: z.boolean().describe("True when the write was rolled back."),
		status: z.literal("forked").describe("The source was copied."),
		overrides: z.array(appliedOverride).describe("The applied overrides, in command-line order."),
		scenario: writtenScenario,
	}),
	examples: [
		{ command: "traj scenario fork base early", description: "Copy a Scenario under a new name." },
		{
			command: "traj scenario fork base early --set flows.salary.amount=50000",
			description: "Copy it with one assumption changed.",
		},
	],
	errorCodes: ["database_busy", "invalid_input", "not_found", "scenario_name_taken"],
	run: (input, ctx) => {
		if (UUID_SHAPED.test(input.name)) return invalidScenarioName()
		const sets = input.set ?? []
		const dryRun = input.dryRun === true
		return withStore(ctx, (store) => {
			const source = store.getScenario(input.from)
			if (isAppError(source)) return source
			if (source === null) return scenarioNotFound(input.from, "from")
			let overrides: AppliedOverride[] = []
			const options: ForkOptions = { dryRun }
			if (sets.length > 0) {
				options.transform = transformFor(sets, (applied) => {
					overrides = applied
				})
			}
			const outcome = store.forkScenario(source.id, input.name, options)
			return reply(outcome, input.from, overrides, dryRun)
		})
	},
})
