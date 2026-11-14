import type { RunsOut } from "@trajectonomics/sim"

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A date's year, month and day, checked as a real calendar date in UTC, so no result depends on
 * the host's zone. The callers pass dates the Ledger or the engine already validated.
 */
function parts(date: string): [number, number, number] {
	const match = ISO.exec(date)
	const [year, month, day] = match === null ? [] : match.slice(1).map(Number)
	if (year === undefined || month === undefined || day === undefined) {
		throw new Error(`"${date}" is not a YYYY-MM-DD date`)
	}
	if (iso(year, month, day) !== date) throw new Error(`"${date}" is not a real calendar date`)
	return [year, month, day]
}

/** One ISO date from UTC parts. */
function iso(year: number, month: number, day: number): string {
	return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10)
}

/** `2026-03-30` → `2026-03-31`. */
export function addDays(date: string, days: number): string {
	const [year, month, day] = parts(date)
	return iso(year, month, day + days)
}

/**
 * The birthday at `age`: the birth date's own month and day, clamped to the month's last day when
 * that day does not exist (29 February becomes 28 February in a common year).
 */
export function birthdayAt(birthDate: string, age: number): string {
	const [year, month, day] = parts(birthDate)
	const target = year + age
	const lastDay = new Date(Date.UTC(target, month, 0)).getUTCDate()
	return iso(target, month, Math.min(day, lastDay))
}

/** Whole calendar months from `from` to `to`, the sign of `to - from`. */
export function monthsBetween(from: string, to: string): number {
	const [fromYear, fromMonth] = parts(from)
	const [toYear, toMonth] = parts(to)
	return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

/** Calendar years from `from` to `to`, the sign of `to - from`. */
export function yearsBetween(from: string, to: string): number {
	return parts(to)[0] - parts(from)[0]
}

/**
 * The row a birthday reads: the last monthly row on or before it, or nothing when the birthday
 * lies before the Projection's first row, past its last, or strictly after a run-out (ADR-0030).
 */
export function rowAt<Row extends { date: string }>(
	rows: readonly Row[],
	birthday: string,
	runsOut: Pick<RunsOut, "date"> | undefined,
): Row | undefined {
	const first = rows[0]
	const last = rows.at(-1)
	if (first === undefined || last === undefined) return undefined
	if (birthday < first.date || birthday > last.date) return undefined
	if (runsOut !== undefined && birthday > runsOut.date) return undefined
	let found: Row | undefined
	for (const row of rows) {
		if (row.date <= birthday) found = row
	}
	return found
}
