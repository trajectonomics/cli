import { z } from "zod"
import { isPlainObject } from "../json"
import type { ScenarioRow } from "../store"

/** The row's metadata without its document: what `scenario list` prints. */
export type ScenarioSummary = {
	id: string
	name: string
	contentHash: string
	forkedFrom: string | null
	version: number
	createdAt: string
	updatedAt: string
}

/** One live Scenario with its document parsed as JSON: what `scenario show` prints. */
export type ScenarioView = ScenarioSummary & { document: Record<string, unknown> }

/** A Scenario a write reports; the id is null when a dry run minted it. */
export type WrittenScenario = Omit<ScenarioView, "id"> & { id: string | null }

/** A Scenario named by `scenario diff`, without its document. */
export type ScenarioRef = { id: string; name: string; contentHash: string }

const summaryShape = {
	id: z.string().describe("The Scenario's UUIDv7 id."),
	name: z.string().describe("The Scenario's exact, case-sensitive name."),
	contentHash: z.string().describe("jcs1:sha256 of the canonical document."),
	forkedFrom: z.string().nullable().describe("The source Scenario's id, or null."),
	version: z.number().int().describe("The row's version."),
	createdAt: z.string().describe("When the row was created."),
	updatedAt: z.string().describe("When the row was last changed."),
}

const documentShape = z
	.record(z.string(), z.unknown())
	.describe("The document parsed from the stored canonical JSON.")

export const scenarioSummary: z.ZodType<ScenarioSummary> = z.strictObject(summaryShape)
export const scenarioView: z.ZodType<ScenarioView> = z.strictObject({
	...summaryShape,
	document: documentShape,
})
export const writtenScenario: z.ZodType<WrittenScenario> = z.strictObject({
	...summaryShape,
	id: z.string().nullable().describe("The Scenario's id; null under --dry-run."),
	document: documentShape,
})
export const scenarioRef: z.ZodType<ScenarioRef> = z.strictObject({
	id: summaryShape.id,
	name: summaryShape.name,
	contentHash: summaryShape.contentHash,
})

export function summary(row: ScenarioRow): ScenarioSummary {
	return {
		id: row.id,
		name: row.name,
		contentHash: row.contentHash,
		forkedFrom: row.forkedFrom,
		version: row.version,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	}
}

export function view(row: ScenarioRow): ScenarioView {
	const document: unknown = JSON.parse(row.document)
	if (!isPlainObject(document)) throw new Error(`Scenario ${row.id} does not hold a JSON object`)
	return { ...summary(row), document }
}

export function ref(row: ScenarioRow): ScenarioRef {
	return { id: row.id, name: row.name, contentHash: row.contentHash }
}
