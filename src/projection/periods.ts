import type { MonthDay } from "@trajectonomics/sim"
import { addDays } from "./dates"

/*
 * A Levy's periods are yearly and recur every year, so the only arithmetic the CLI needs is the
 * date a period starts on. sim-core owns the rule that decides which periods a Projection needs a
 * Carry-in for; `carryInStarts` mirrors it, and the engine is the oracle that keeps the mirror honest.
 */

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
 * The period starts the engine requires a Carry-in for, in engine order, mirroring its own rule:
 * the period containing the As-of needs one when the As-of is inside it, and the period before
 * needs one too when its Settlement still falls inside the Projection. The engine is the oracle —
 * the taxed-projection test fails if this ever disagrees with it.
 */
export function carryInStarts(
	asOf: string,
	levy: { period: MonthDay; settlement: MonthDay },
): string[] {
	const current = periodStartAtOrBefore(asOf, levy.period)
	const previous = periodStartAtOrBefore(addDays(current, -1), levy.period)
	const priorYearSettles = settlementAfter(addDays(current, -1), levy.settlement) >= asOf
	const starts: string[] = []
	if (priorYearSettles) starts.push(previous)
	if (asOf !== current) starts.push(current)
	return starts
}

/** A `MonthDay` a stored Levy states, or `undefined` when it does not state one. */
export function storedMonthDay(value: unknown): MonthDay | undefined {
	if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined
	const month = (value as Record<string, unknown>)["month"]
	const day = (value as Record<string, unknown>)["day"]
	if (typeof month !== "number" || typeof day !== "number") return undefined
	return { month, day }
}
