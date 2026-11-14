import { z } from "zod"
import type { FiAnswer } from "./fi-view"
import { fiAnswer } from "./fi-view"
import { dateField, moneyField } from "./money"
import { overrideEcho, runsOut, scenarioEcho, TAX_VALUES } from "./view"

/** One side of a `projection compare`: its own answer, its net worth figures and its run-out. */
export type CompareSide = {
	scenario: { id: string; name: string; contentHash: string; effectiveContentHash: string }
	overrides: { path: string; value: unknown }[]
	fi: FiAnswer
	runOut: { date: string; unmet: string } | null
	netWorth: {
		final: { date: string; nominal: string; real: string }
		atAges: { age: number; nominal: string | null; real: string | null }[]
	}
}

/** The deltas `projection compare` reports: second minus first, null where there is no meaning. */
export type CompareDeltas = {
	fiMonths: number | null
	runOutYears: number | null
	netWorth: { nominal: string; real: string }
	atAges: { age: number; nominal: string | null; real: string | null }[]
}

/** `traj projection compare`: two Projections side by side and their deltas (ADR-0030). */
export type CompareView = {
	asOf: string
	horizon: string
	currency: string
	engine: { package: string; version: string }
	birthDate: string | null
	sides: { a: CompareSide; b: CompareSide }
	deltas: CompareDeltas
	tax: "applied" | "not_applied"
	notes: string[]
}

const atAges = (what: string) =>
	z
		.array(
			z.strictObject({
				age: z.number().int().describe("The age asked for with --age."),
				nominal: moneyField(what).nullable(),
				real: moneyField("The same figure in start-of-timeline terms").nullable(),
			}),
		)
		.describe("One entry per --age, in the order given.")

export const compareSide: z.ZodType<CompareSide> = z.strictObject({
	scenario: scenarioEcho,
	overrides: z.array(overrideEcho).describe("The applied overrides for this side, in order."),
	fi: fiAnswer.describe("This side's own FI answer."),
	runOut: runsOut.nullable().describe("The month this side runs out of money, or null."),
	netWorth: z.strictObject({
		final: z.strictObject({
			date: dateField("The Projection's last row"),
			nominal: moneyField("Net worth at the Projection's end"),
			real: moneyField("The same figure in start-of-timeline terms"),
		}),
		atAges: atAges("Net worth at that age"),
	}),
})

export const compareView: z.ZodType<CompareView> = z.strictObject({
	asOf: dateField("The date both Projections start at"),
	horizon: dateField("The date both Projections end at"),
	currency: z.string().describe("The Scenario's ISO 4217 currency; v1 is THB only."),
	engine: z.strictObject({
		package: z.string().describe("The engine's package name."),
		version: z.string().describe("The exact engine version the projections ran on."),
	}),
	birthDate: z.string().nullable().describe("The birth date the ages are counted from, or null."),
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
		netWorth: z.strictObject({
			nominal: moneyField("Second minus first, at the Projection's end"),
			real: moneyField("The same difference in start-of-timeline terms"),
		}),
		atAges: atAges("Second minus first at that age"),
	}),
	tax: z
		.enum(TAX_VALUES)
		.describe("The tax status of every figure; `not_applied` until a tax core is wired in."),
	notes: z
		.array(z.string())
		.describe(
			"Plain sentences a person should read before the figures; the human format prints them.",
		),
})
