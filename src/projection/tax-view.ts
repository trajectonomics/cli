import type { LevyReport } from "@trajectonomics/sim"
import { z } from "zod"
import { dateField, moneyField, moneyOf } from "./money"

/**
 * One Levy period as a Projection reports it: what the period owed, what was prepaid, and what
 * settles. Every figure is the engine's own `SettlementPeriod`; the CLI only formats it (ADR-0036).
 */
export type TaxYearView = {
	levy: string
	from: string
	to: string
	settlementDate: string
	due: string
	prepaid: string
	owed: string
	settled: boolean
	partial: boolean
}

export const taxYearView: z.ZodType<TaxYearView> = z.strictObject({
	levy: z.string().describe("The Levy's id, as the Scenario spells it."),
	from: dateField("The period's first day"),
	to: dateField("The period's last day"),
	settlementDate: dateField("The day the amount owed is due to be paid"),
	due: moneyField("The tax the period owes before any Prepayment"),
	prepaid: moneyField("The tax already paid at source in this period"),
	owed: moneyField(
		"The tax still to pay after Prepayment: due minus prepaid; a negative figure is a refund",
	),
	settled: z
		.boolean()
		.describe(
			"Whether the settlement date falls inside the Projection, so its charge is included.",
		),
	partial: z
		.boolean()
		.describe("Whether the Projection ended before the period did, so the period is incomplete."),
})

/** One entry per Levy period, in the engine's own Levy and period order. */
export const taxYearsField: z.ZodType<TaxYearView[]> = z
	.array(taxYearView)
	.describe(
		"One entry per Levy settlement period: what each tax year owed, was prepaid, and settles. Empty when the Scenario holds no Levy.",
	)

/**
 * The Projection's Levy periods in the CLI's money. `owed` is the engine's own `settlement`, which
 * it already computes as due minus prepaid (ADR-0032); the CLI subtracts nothing.
 */
export function taxYearsOf(
	levies: readonly LevyReport[] | undefined,
	currency: string,
): TaxYearView[] {
	if (levies === undefined) return []
	return levies.flatMap((levy) =>
		levy.periods.map((period) => ({
			levy: levy.id,
			from: period.from,
			to: period.to,
			settlementDate: period.settlementDate,
			due: moneyOf(currency)(period.due),
			prepaid: moneyOf(currency)(period.prepaid),
			owed: moneyOf(currency)(period.settlement),
			settled: period.settled,
			partial: period.partial,
		})),
	)
}
