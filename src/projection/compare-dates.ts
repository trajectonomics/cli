import type { ProjectionRow, RunsOut } from "@trajectonomics/sim"

/**
 * The birthday at `age`: the birth date's own month and day, clamped to the month's last day when
 * that day does not exist (29 February becomes 28 February in a common year).
 */
export function birthdayAt(birthDate: string, age: number): string {
	const [year, month, day] = birthDate.split("-").map(Number)
	if (year === undefined || month === undefined || day === undefined) {
		throw new Error(`"${birthDate}" is not a YYYY-MM-DD date`)
	}
	const target = year + age
	const lastDay = new Date(Date.UTC(target, month, 0)).getUTCDate()
	return new Date(Date.UTC(target, month - 1, Math.min(day, lastDay))).toISOString().slice(0, 10)
}

/** Whole calendar months from `from` to `to`, the sign of `to - from`. */
export function monthsBetween(from: string, to: string): number {
	const [fromYear, fromMonth] = from.split("-").map(Number)
	const [toYear, toMonth] = to.split("-").map(Number)
	if (fromYear === undefined || fromMonth === undefined) throw new Error(`"${from}" is not a date`)
	if (toYear === undefined || toMonth === undefined) throw new Error(`"${to}" is not a date`)
	return (toYear - fromYear) * 12 + (toMonth - fromMonth)
}

/** Calendar years from `from` to `to`, the sign of `to - from`. */
export function yearsBetween(from: string, to: string): number {
	const [fromYear] = from.split("-").map(Number)
	const [toYear] = to.split("-").map(Number)
	if (fromYear === undefined || toYear === undefined) throw new Error(`"${from}" is not a date`)
	return toYear - fromYear
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
