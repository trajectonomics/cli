import type { MonthDay, Scenario } from "@trajectonomics/sim"
import type { ScenarioDocument } from "../scenario/document"
import { hasTaxLevy, TAX_LEVY_ID } from "../scenario/tax"
import { addDays } from "./dates"

/*
 * The one part of a Levy that depends on the projection rather than the plan: the Carry-in. It
 * records what a period had already tallied before the Timeline started, so it is read from the
 * As-of, exactly like the Timeline itself — a stored Scenario cannot hold it (ADR-0032).
 */

/** The one sentence a person must read before the figures, so a pre-tax plan is not mistaken. */
export const NO_TAX: string = "No tax is applied; figures are before tax."

/** `YYYY-MM-DD` from a year and a one-based month, with the day clamped to the month's length. */
function dateOf(year: number, month: number, day: number): string {
	const at = new Date(0)
	at.setUTCFullYear(year, month - 1, day)
	return at.toISOString().slice(0, 10)
}

/** A `MonthDay` as `MM-DD`, clamped so 31 February becomes the month's last day. */
function monthDay(monthDay: MonthDay): string {
	return dateOf(2000, monthDay.month, monthDay.day).slice(5)
}

/** The latest `<period>` on or before `date`, which is how a Levy's periods are numbered. */
export function periodStartAtOrBefore(date: string, period: MonthDay): string {
	const year = Number(date.slice(0, 4))
	const thisYear = `${String(year).padStart(4, "0")}-${monthDay(period)}`
	if (thisYear <= date) return thisYear
	return `${String(year - 1).padStart(4, "0")}-${monthDay(period)}`
}

/** The first `<settlement>` strictly after `date`. */
export function settlementAfter(date: string, settlement: MonthDay): string {
	const year = Number(date.slice(0, 4))
	const thisYear = `${String(year).padStart(4, "0")}-${monthDay(settlement)}`
	if (thisYear > date) return thisYear
	return `${String(year + 1).padStart(4, "0")}-${monthDay(settlement)}`
}

/**
 * The period starts the engine requires a Carry-in for, in order, mirroring its own rule: the
 * period containing the As-of needs one when the As-of is inside it, and the period before needs
 * one too when its Settlement still falls inside the Projection. The engine is the oracle — the
 * taxed-projection test fails if this ever disagrees with it.
 */
export function carryInPlan(
	asOf: string,
	levy: { period: MonthDay; settlement: MonthDay },
): { starts: string[]; priorYearSettles: boolean } {
	const current = periodStartAtOrBefore(asOf, levy.period)
	const previous = periodStartAtOrBefore(addDays(current, -1), levy.period)
	const priorYearSettles = settlementAfter(addDays(current, -1), levy.settlement) >= asOf
	const starts: string[] = []
	if (priorYearSettles) starts.push(previous)
	if (asOf !== current) starts.push(current)
	return { starts, priorYearSettles }
}

/** The period starts a Levy needs a Carry-in for, in engine order. */
export function carryInStarts(
	asOf: string,
	levy: { period: MonthDay; settlement: MonthDay },
): string[] {
	return carryInPlan(asOf, levy).starts
}

/** The Scenario's Levies, as JSON, so the CLI can read the two fields a Carry-in needs. */
function leviesOf(document: ScenarioDocument): Record<string, unknown>[] {
	const levies = document["levies"]
	if (!Array.isArray(levies)) return []
	return levies.filter(
		(levy): levy is Record<string, unknown> =>
			typeof levy === "object" && levy !== null && !Array.isArray(levy),
	)
}

/** A `MonthDay` a stored Levy states, or `undefined` when it does not state one. */
function storedMonthDay(value: unknown): MonthDay | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
	const month = (value as Record<string, unknown>)["month"]
	const day = (value as Record<string, unknown>)["day"]
	if (typeof month !== "number" || typeof day !== "number") return undefined
	return { month, day }
}

/**
 * Adds the Carry-in records the As-of implies to this build's tax Levy, and leaves every other
 * Levy exactly as the caller wrote it: a Levy the CLI did not emit is the caller's own, and a
 * projection that quietly assumed "nothing was tallied before the As-of" would be inventing a
 * fact. The engine still refuses such a Levy with MISSING_CARRY_IN, which is the honest answer.
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
 * The sentences a person must read about the figures' tax. The tax Levy's own period decides
 * whether the first year is whole, so a projection that starts mid-year is never silent about it.
 */
export function taxNotes(document: ScenarioDocument, asOf: string): string[] {
	if (!hasTaxLevy(document)) return [NO_TAX]
	const notes = [
		`Tax is applied: Thailand 2026 personal income tax, from the Scenario's Levy "${TAX_LEVY_ID}".`,
	]
	const levy = leviesOf(document).find((it) => it["id"] === TAX_LEVY_ID)
	const period = storedMonthDay(levy?.["period"]) ?? { month: 1, day: 1 }
	const settlement = storedMonthDay(levy?.["settlement"]) ?? { month: 3, day: 31 }
	const current = periodStartAtOrBefore(asOf, period)
	if (asOf !== current) {
		const year = current.slice(0, 4)
		notes.push(`The ${year} tax year is charged on the Flows from ${asOf}, not the whole year.`)
	}
	if (carryInPlan(asOf, { period, settlement }).priorYearSettles) {
		const year = current.slice(0, 4)
		notes.push(
			`Tax before ${year} is not recomputed; any tax still owed belongs in the Ledger as a liability.`,
		)
	}
	return notes
}
