import type { ScenarioDocument } from "../scenario/document"
import { leviesOf, TAX_LEVY_ID } from "../scenario/tax"
import type { CarryInEcho } from "./carryin-view"
import { periodStartAtOrBefore, storedMonthDay } from "./periods"

/** The one sentence a person must read before the figures, so a pre-tax plan is not mistaken. */
export const NO_TAX: string = "No tax is applied; figures are before tax."

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
function periodNotes(levy: Record<string, unknown>, asOf: string, scoped: boolean): string[] {
	const period = storedMonthDay(levy["period"])
	if (period === undefined) return []
	const current = periodStartAtOrBefore(asOf, period)
	const year = current.slice(0, 4)
	const notes: string[] = []
	// A period the As-of starts inside is charged on the part of the year it covers, plus the
	// Carry-in the caller stated for the months before it, and the sentence says both.
	if (asOf !== current) {
		notes.push(
			`The ${year} tax year is charged on the Flows from ${asOf} plus the stated Carry-in, not the whole year.`,
		)
	}
	// Only the CLI's own scope record means no tax before this year was computed at all: a record
	// the caller stated is what that period settled, and saying otherwise would deny its figures.
	if (scoped) {
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
export function taxNotes(
	document: ScenarioDocument,
	asOf: string,
	carryIn: readonly CarryInEcho[],
): string[] {
	const levies = leviesOf(document)
	if (levies.length === 0) return [NO_TAX]
	const scoped = new Set(carryIn.filter((it) => it.source === "scope").map((it) => it.levy))
	const notes: string[] = []
	for (const levy of levies) {
		const id = levy["id"]
		if (typeof id !== "string" || id === "") continue
		notes.push(levySentence(id), ...periodNotes(levy, asOf, scoped.has(id)))
	}
	return [...new Set(notes)]
}

/** Whether the Scenario holds one or more Tax Levies, whichever rule set wrote them (ADR-0032). */
export function hasAnyLevy(document: ScenarioDocument): boolean {
	return leviesOf(document).length > 0
}
