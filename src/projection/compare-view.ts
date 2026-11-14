import { z } from "zod"
import { type AgeFigure, ageFigures } from "./ages-view"
import { type CompareSide, compareSide } from "./compare-side"
import { dateField, moneyField } from "./money"
import { type EngineEcho, engineEcho, notesField, type TaxStatus, taxField } from "./view"

/** The deltas `projection compare` reports: second minus first, null where there is no meaning. */
export type CompareDeltas = {
	fiMonths: number | null
	runOutYears: number | null
	netWorth: { nominal: string; real: string } | null
	atAges: AgeFigure[]
}

/** `traj projection compare`: two Projections side by side and their deltas (ADR-0030). */
export type CompareView = {
	asOf: string
	horizon: string
	currency: string
	engine: EngineEcho
	birthDate: string | null
	sides: { a: CompareSide; b: CompareSide }
	deltas: CompareDeltas
	tax: TaxStatus
	notes: string[]
}

export const compareView: z.ZodType<CompareView> = z.strictObject({
	asOf: dateField("The date both Projections start at"),
	horizon: dateField("The date both Projections end at"),
	currency: z.string().describe("The Scenario's ISO 4217 currency; v1 is THB only."),
	engine: engineEcho,
	birthDate: dateField("The birth date the ages are counted from, or null").nullable(),
	sides: z.strictObject({
		a: compareSide.describe("The first Scenario, or the base of a what-if."),
		b: compareSide.describe("The second Scenario, or the what-if of the first."),
	}),
	deltas: z.strictObject({
		fiMonths: z
			.number()
			.int()
			.nullable()
			.describe(
				"Whole calendar months from the first FI date to the second; null if either is unreachable.",
			),
		runOutYears: z
			.number()
			.int()
			.nullable()
			.describe("Calendar years from the first run-out to the second; null unless both run out."),
		netWorth: z
			.strictObject({
				nominal: moneyField("Second minus first, at the Projection's end"),
				real: moneyField("The same difference in start-of-timeline terms"),
			})
			.nullable()
			.describe("Null unless both Projections end on the same date, as two that run out need not."),
		atAges: ageFigures("Second minus first at that age"),
	}),
	tax: taxField,
	notes: notesField,
})
