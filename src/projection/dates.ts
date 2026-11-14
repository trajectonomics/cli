import type { ProjectionRow, RunsOut } from "@trajectonomics/sim"

/** A date's year, month and day, in UTC, so no result depends on the host's zone. */
function parts(date: string): [number, number, number] {
	const [year, month, day] = date.split("-").map(Number)
	if (year === undefined || month === undefined || day === undefined) {
		throw new Error(`"${date}" is not a YYYY-MM-DD date`)
	}
	if (![year, month, day].every((part) => Number.isSafeInteger(part))) {
		throw new Error(`"${date}" is not a YYYY-MM-DD date`)
	}
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
export function rowAt(
	rows: readonly ProjectionRow[],
	birthday: string,
	runsOut: RunsOut | undefined,
): ProjectionRow | undefined {
	const first = rows[0]
	const last = rows.at(-1)
	if (first === undefined || last === undefined) return undefined
	if (birthday < first.date || birthday > last.date) return undefined
	if (runsOut !== undefined && birthday > runsOut.date) return undefined
	let found: ProjectionRow | undefined
	for (const row of rows) {
		if (row.date <= birthday) found = row
	}
	return found
}
