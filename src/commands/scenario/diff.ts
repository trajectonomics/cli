import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { isAppError } from "../../errors"
import { diffDocuments } from "../../scenario/diff"
import { scenarioNotFound } from "../../scenario/errors"
import { ref, scenarioRef } from "../../scenario/view"
import { withStore } from "../../with-store"

const change = z.strictObject({
	path: z.string().describe("The dotted path, escaped and canonical."),
	kind: z.enum(["added", "removed", "changed"]).describe("What happened at the path."),
	before: z.unknown().optional().describe("The value before, for removed and changed."),
	after: z.unknown().optional().describe("The value after, for added and changed."),
})

export const diff: Leaf = defineCommand({
	name: "diff",
	summary: "Compare two Scenario documents path by path",
	positionals: ["a", "b"],
	input: z.strictObject({
		a: z.string().describe("The first Scenario's exact name or id."),
		b: z.string().describe("The second Scenario's exact name or id."),
	}),
	output: z.strictObject({
		a: scenarioRef,
		b: scenarioRef,
		identical: z.boolean().describe("True exactly when `changes` is empty."),
		changes: z.array(change).describe("The structural changes, sorted by path."),
	}),
	examples: [
		{ command: "traj scenario diff base early", description: "Show what a what-if changed." },
		{ command: "traj scenario diff base base", description: "Compare a Scenario with itself." },
	],
	errorCodes: ["not_found"],
	run: (input, ctx) =>
		withStore(ctx, (store) => {
			const a = store.getScenario(input.a)
			if (isAppError(a)) return a
			if (a === null) return scenarioNotFound(input.a, "a")
			const b = store.getScenario(input.b)
			if (isAppError(b)) return b
			if (b === null) return scenarioNotFound(input.b, "b")
			const changes = diffDocuments(JSON.parse(a.document), JSON.parse(b.document))
			return ok({ a: ref(a), b: ref(b), identical: changes.length === 0, changes })
		}),
})
