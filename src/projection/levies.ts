import type { Scenario } from "@trajectonomics/sim"
import type { ScenarioDocument } from "../scenario/document"
import { leviesOf, TAX_LEVY_ID } from "../scenario/tax"
import { carryInPlan, carryInStarts, periodStartAtOrBefore, storedMonthDay } from "./periods"

/** The one sentence a person must read before the figures, so a pre-tax plan is not mistaken. */
export const NO_TAX: string = "No tax is applied; figures are before tax."

/**
 * Adds the Carry-in records the As-of implies to this build's tax Levy, and leaves every other
 * Levy exactly as the caller wrote it (ADR-0032).
 */
export function withCarryIn(document: Scenario, asOf: string): Scenario {
	const levies = document.levies
	if (levies === undefined) return document
	return {
		...document,
		levies: levies.map((levy) => {
			if (levy.id !== TAX_LEVY_ID) return levy
			if ((levy.carryIn ?? []).length > 0) return levy
			const period = levy.period
			const settlement = levy.settlement
			if (period === undefined || settlement === undefined) return levy
			const starts = carryInStarts(asOf, { period, settlement })
			return {
				...levy,
				carryIn: starts.map((periodStart) => ({ periodStart, tallies: [], prepaid: 0 })),
			}
		}),
	}
}

/**
 * The one sentence for a Levy, which names the jurisdiction only for the Levy this build emits:
 * a Levy the caller wrote is the Scenario's own, and the CLI claims no rule it cannot see.
 */
function levySentence(id: string): string {
	if (id === TAX_LEVY_ID) {
		return `Tax is applied: Thailand 2026 personal income tax, from the Scenario's Levy "${id}".`
	}
	return `Tax is applied: the Scenario's own Levy "${id}".`
}

/** The sentences one Levy's own period adds, or none when it states no period. */
function periodNotes(levy: Record<string, unknown>, asOf: string): string[] {
	const period = storedMonthDay(levy["period"])
	if (period === undefined) return []
	const settlement = storedMonthDay(levy["settlement"])
	const current = periodStartAtOrBefore(asOf, period)
	const year = current.slice(0, 4)
	const notes: string[] = []
	// A period the As-of starts inside is charged on a part of the year, and says so.
	if (asOf !== current) {
		notes.push(`The ${year} tax year is charged on the Flows from ${asOf}, not the whole year.`)
	}
	if (settlement !== undefined && carryInPlan(asOf, { period, settlement }).priorYearSettles) {
		notes.push(
			`Tax before ${year} is not recomputed; any tax still owed belongs in the Ledger as a liability.`,
		)
	}
	return notes
}

/**
 * The sentences a person must read about the figures' tax. The Tax status is the Scenario's
 * Levies, whichever emitted them (ADR-0032), and each Levy's own period decides whether the first
 * year is whole, so a projection that starts mid-year is never silent about it. The same sentence
 * twice is one sentence: two Levies can share a period and its year.
 */
export function taxNotes(document: ScenarioDocument, asOf: string): string[] {
	const levies = leviesOf(document)
	if (levies.length === 0) return [NO_TAX]
	const notes: string[] = []
	for (const levy of levies) {
		const id = levy["id"]
		if (typeof id !== "string" || id === "") continue
		notes.push(levySentence(id), ...periodNotes(levy, asOf))
	}
	return [...new Set(notes)]
}

/** Whether the Scenario holds one or more Tax Levies, whichever rule set wrote them (ADR-0032). */
export function hasAnyLevy(document: ScenarioDocument): boolean {
	return leviesOf(document).length > 0
}
