import type { TallyBasis } from "@trajectonomics/sim"
import { z } from "zod"
import { dateField, moneyField } from "./money"

/** The bases a Carry-in tally may state, as the engine's own type names them (ADR-0004). */
export const CARRY_IN_BASES: readonly [TallyBasis, ...TallyBasis[]] = [
	"gross",
	"funded",
	"returns",
	"gains",
]

/** Whether a stored value is one of the bases the engine tallies under. */
export function isBasis(value: unknown): value is TallyBasis {
	return typeof value === "string" && (CARRY_IN_BASES as readonly string[]).includes(value)
}

/** Where a placed record came from: the flag, the stored Scenario, or the CLI's own scope record. */
export const CARRY_IN_SOURCES = ["flag", "document", "scope"] as const

export type CarryInSource = (typeof CARRY_IN_SOURCES)[number]

/** One class of a period's Carry-in, as every result echoes it: amounts at the currency's scale. */
export type CarryInTallyEcho = { label: string; basis: TallyBasis; amount: string }

/** One resolved Carry-in record, as every projection result echoes it (ADR-0030, ADR-0032). */
export type CarryInEcho = {
	levy: string
	periodStart: string
	tallies: CarryInTallyEcho[]
	prepaid: string
	source: CarryInSource
}

const tallyEcho: z.ZodType<CarryInTallyEcho> = z.strictObject({
	label: z.string().describe("The Tally label the class is tallied under."),
	basis: z.enum(CARRY_IN_BASES).describe("The basis the Levy tallies that label under."),
	amount: moneyField("What that class tallied in the period"),
})

export const carryInEcho: z.ZodType<CarryInEcho[]> = z.array(
	z.strictObject({
		levy: z.string().describe("The Levy's id, as the Scenario spells it."),
		periodStart: dateField("The period's first day"),
		tallies: z
			.array(tallyEcho)
			.describe("What the period tallied, in the Levy's own class order; `rest` expanded."),
		prepaid: moneyField("What the period had already prepaid"),
		source: z
			.enum(CARRY_IN_SOURCES)
			.describe(
				"Where the record came from: `flag` from --carry-in, `document` from the stored Scenario, `scope` from the CLI's own scope record.",
			),
	}),
)

/** The echo field, present only when the Projection placed at least one record. */
export const carryInField: z.ZodOptional<z.ZodType<CarryInEcho[]>> = carryInEcho
	.optional()
	.describe("The Carry-in records the Projection used; absent when it used none.")
