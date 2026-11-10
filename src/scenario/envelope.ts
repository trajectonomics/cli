import { z } from "zod"
import { type AppError, fail } from "../errors"
import { isPlainObject } from "../json"

// Until `sim-core` owns the Scenario schema, a document is opaque JSON with one structural rule
// (ADR-0024). The zod schema is what the document form and `traj schema` print; `envelopeProblem`
// is the same rule as data, so the Store can report it at its own path (an import, for example).
// Both spell the messages identically, so the same document gives the same envelope whichever
// route reaches the validator.

/** A Scenario document: opaque JSON with a positive-integer `schemaVersion`. */
export type ScenarioDocument = Record<string, unknown>

const OBJECT_MESSAGE = "document: must be a JSON object"
const VERSION_MESSAGE = "document.schemaVersion: must be a positive integer"

const version: z.ZodNumber = z
	.number({ error: VERSION_MESSAGE })
	.int({ error: VERSION_MESSAGE })
	.min(1, { error: VERSION_MESSAGE })
	.max(Number.MAX_SAFE_INTEGER, { error: VERSION_MESSAGE })

const envelopeShape: z.ZodRawShape = { schemaVersion: version }

export const scenarioDocument: z.ZodType<ScenarioDocument> = z.looseObject(envelopeShape, {
	error: OBJECT_MESSAGE,
})

export type EnvelopeProblem = { segments: readonly string[]; why: string }

/** The envelope rule as plain data: the offending field and why it fails. */
export function envelopeProblem(value: unknown): EnvelopeProblem | null {
	if (!isPlainObject(value)) return { segments: [], why: "must be a JSON object" }
	const version = value["schemaVersion"]
	if (!Number.isSafeInteger(version) || (version as number) < 1) {
		return { segments: ["schemaVersion"], why: "must be a positive integer" }
	}
	return null
}

/** The envelope failure at `base`, with the Store and document-form paths both built here. */
export function envelopeError(value: unknown, base = "document"): AppError | null {
	const problem = envelopeProblem(value)
	if (problem === null) return null
	const path = [base, ...problem.segments].join(".")
	const message = `${path}: ${problem.why}`
	return fail("invalid_input", { path, message, details: [{ path, message }] })
}
