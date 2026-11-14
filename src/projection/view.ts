import { z } from "zod"
import { dateField, moneyField } from "./money"

/** `tax` is a closed enum so a later tax core adds a value rather than a flag (ADR-0030). */
export type TaxStatus = "applied" | "not_applied"

export const TAX_VALUES: readonly [TaxStatus, ...TaxStatus[]] = ["applied", "not_applied"]

/** The engine a Projection ran on: its package and the exact version (ADR-0030). */
export type EngineEcho = { package: string; version: string }

/** The Scenario a Projection was computed from, before and after the applied Overrides. */
export type ScenarioEcho = {
	id: string
	name: string
	contentHash: string
	effectiveContentHash: string
}

/** One applied `--set`, in command-line order (ADR-0024). */
export type OverrideEcho = { path: string; value: unknown }

/** Where a Projection runs out of money: the engine's own row and shortfall. */
export type RunsOutView = { date: string; unmet: string }

/** Every result's echo block: what it was computed from, so it can be reproduced (ADR-0007). */
export type Echo = {
	asOf: string
	engine: EngineEcho
	scenario: ScenarioEcho
	overrides: OverrideEcho[]
	tax: TaxStatus
	notes: string[]
}

export const engineEcho: z.ZodType<EngineEcho> = z.strictObject({
	package: z.string().describe("The engine's package name."),
	version: z.string().describe("The exact engine version the projection ran on."),
})

export const scenarioEcho: z.ZodType<ScenarioEcho> = z.strictObject({
	id: z.string().describe("The Scenario's UUIDv7 id."),
	name: z.string().describe("The Scenario's exact, case-sensitive name."),
	contentHash: z.string().describe("jcs1:sha256 of the stored document."),
	effectiveContentHash: z
		.string()
		.describe(
			"jcs1:sha256 of the document after the applied overrides; equal to contentHash with none.",
		),
})

export const overrideEcho: z.ZodType<OverrideEcho> = z.strictObject({
	path: z.string().describe("The dotted path, escaped and canonical."),
	value: z.unknown().describe("The JSON value the path was set to."),
})

export const runsOut: z.ZodType<RunsOutView> = z.strictObject({
	date: dateField("The month the Projection ran out of money"),
	unmet: moneyField("The spending the Projection could not fund in that month"),
})

/** The As-of every projection result states (ADR-0030). */
export const asOfField: z.ZodType<string> = dateField("The date the Projection starts at")

/** The applied Overrides, in command-line order (ADR-0024). */
export const overridesField: z.ZodType<OverrideEcho[]> = z
	.array(overrideEcho)
	.describe("The applied overrides, in command-line order; empty when none were given.")

/** The tax status is a closed enum, so a tax core adds a value rather than a flag. */
export const taxField: z.ZodType<TaxStatus> = z
	.enum(TAX_VALUES)
	.describe("The tax status of every figure; `not_applied` until a tax core is wired in.")

/** Plain sentences a person should read; only the human Format prints them. */
export const notesField: z.ZodType<string[]> = z
	.array(z.string())
	.describe(
		"Plain sentences a person should read before the figures; the human format prints them.",
	)
