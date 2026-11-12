import { check, type Problem } from "@trajectonomics/sim"
import { version as simVersion } from "@trajectonomics/sim/package.json"
import { z } from "zod"
import { type AppError, fail } from "../errors"

// `sim-core` owns the Scenario model (AGENTS.md rule 5, ADR-0024). Its `check()` reads a Baseline,
// a Scenario and a Timeline in one pass and returns `{ code, path }` problems, so the CLI validates
// a Scenario by giving it the neutral Baseline and no Timeline and keeping the `scenario.` problems.
// Nothing is restated here: the codes, their order and the paths are all the core's.

/** A Scenario document. `sim-core` decides whether a value is one; the CLI keeps it as JSON. */
export type ScenarioDocument = Record<string, unknown>

/** One reason `sim-core` refuses a document, with the path inside the document. */
export type ScenarioProblem = {
	readonly code: Problem["code"]
	readonly segments: readonly (string | number)[]
}

/** An empty Baseline v1: valid on its own, and it names no Account the Scenario could rely on. */
const NEUTRAL_BASELINE = { schemaVersion: 1, balances: [] } as const

/**
 * `MISSING_CARRY_IN` depends on the Timeline's start, so it is a `projection run` failure (#11).
 * Passing `null` for the Timeline already stops `sim-core`'s Timeline checks; dropping the code as
 * well guards against a later `sim-core` that reports it another way.
 */
const TIMELINE_CODES: ReadonlySet<string> = new Set(["MISSING_CARRY_IN"])

/** The problems `sim-core` finds in a document alone, in its order, with `scenario.` stripped. */
export function scenarioProblems(value: unknown): ScenarioProblem[] {
	return check(NEUTRAL_BASELINE, value, null)
		.filter((problem) => problem.path[0] === "scenario" && !TIMELINE_CODES.has(problem.code))
		.map((problem) => ({ code: problem.code, segments: problem.path.slice(1) }))
}

/** The document path as the CLI prints it: `base` plus segments, a list index as a number. */
export function documentPath(base: string, segments: readonly (string | number)[]): string {
	return [base, ...segments].join(".")
}

function detailsOf(problems: readonly ScenarioProblem[], base: string) {
	return problems.map((problem) => {
		const path = documentPath(base, problem.segments)
		return { path, message: `${path}: ${problem.code}`, code: problem.code }
	})
}

/** The `invalid_input` for a document `sim-core` refuses, or null when it accepts the document. */
export function scenarioDocumentError(value: unknown, base = "document"): AppError | null {
	const problems = scenarioProblems(value)
	if (problems.length === 0) return null
	const first = problems[0]
	if (first === undefined) return null
	const path = documentPath(base, first.segments)
	return fail("invalid_input", {
		path,
		message: `${path}: ${first.code}`,
		details: detailsOf(problems, base),
	})
}

/**
 * The document form's schema and `traj schema`'s view of it (ADR-0020). It accepts any JSON value
 * and defers to `sim-core`, so `NOT_AN_OBJECT` and `UNSUPPORTED_SCHEMA_VERSION` are the core's
 * codes and this layer never rejects a document first. Its JSON Schema is the envelope level only:
 * the CLI does not restate `sim-core`'s model (ADR-0024).
 */
export const scenarioDocument: z.ZodType<unknown> = z
	.unknown()
	.superRefine((value, ctx) => {
		for (const problem of scenarioProblems(value)) {
			ctx.addIssue({
				code: "custom",
				message: `${documentPath("document", problem.segments)}: ${problem.code}`,
				path: [...problem.segments],
				params: { code: problem.code },
			})
		}
	})
	.meta({
		type: "object",
		properties: { schemaVersion: {} },
		required: ["schemaVersion"],
		description: `A Scenario document, validated by @trajectonomics/sim@${simVersion}'s check() with an empty Baseline and no Timeline.`,
	})
