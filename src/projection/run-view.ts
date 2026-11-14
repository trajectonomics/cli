import { z } from "zod"
import { dateField } from "./money"
import { type AnnualRow, annualRow, type MonthlyRow, monthlyRow } from "./rows-view"
import {
	asOfField,
	type Echo,
	engineEcho,
	notesField,
	overridesField,
	type RunsOutView,
	runsOut,
	scenarioEcho,
	taxField,
} from "./view"

export type { AnnualRow, MonthlyRow } from "./rows-view"

/** The Projection's annual roll-up, or its monthly rows with `--monthly`. */
export type ProjectionTable =
	| { name: "annual"; count: number; rows: AnnualRow[] }
	| { name: "monthly"; count: number; rows: MonthlyRow[] }

/** `traj projection run`: the Projection plus the echo block (ADR-0030). */
export type ProjectionRunView = Echo & {
	horizon: string
	currency: string
	runsOut: RunsOutView | null
	tables: ProjectionTable[]
}

export const projectionTable: z.ZodType<ProjectionTable> = z.union([
	z.strictObject({
		name: z.literal("annual").describe("The engine's annual roll-up."),
		count: z.number().int().describe("The number of roll-up rows."),
		rows: z.array(annualRow).describe("One row per year, in order."),
	}),
	z.strictObject({
		name: z.literal("monthly").describe("The monthly rows, present only with --monthly."),
		count: z.number().int().describe("The number of monthly rows."),
		rows: z.array(monthlyRow).describe("One row per month, in order."),
	}),
])

export const projectionRunView: z.ZodType<ProjectionRunView> = z.strictObject({
	asOf: asOfField,
	engine: engineEcho,
	scenario: scenarioEcho,
	overrides: overridesField,
	tax: taxField,
	notes: notesField,
	horizon: dateField("The date the Projection ends at"),
	currency: z.string().describe("The Scenario's ISO 4217 currency; v1 is THB only."),
	runsOut: runsOut
		.nullable()
		.describe("The month the Projection ran out of money, or null when it never does."),
	tables: z
		.array(projectionTable)
		.describe("The annual roll-up, and the monthly rows when --monthly was given."),
})
