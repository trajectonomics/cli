import { type AppError, fail } from "./errors"

/**
 * The Gregorian years the CLI accepts in a caller's date. A Buddhist year is 543 ahead, so a date
 * typed in the Thai calendar lands here as 2569 and is refused instead of silently stored as the
 * year 2569 (cli#150).
 */
export const FIRST_SUPPORTED_YEAR = 1900
export const LAST_SUPPORTED_YEAR = 2100

/** The four-digit year of a `YYYY-MM-DD` value outside the supported range, or `undefined`. */
export function unsupportedYear(value: string): string | undefined {
	const year = /^(\d{4})-\d{2}-\d{2}$/.exec(value)?.[1]
	if (year === undefined) return undefined
	const number = Number(year)
	return number >= FIRST_SUPPORTED_YEAR && number <= LAST_SUPPORTED_YEAR ? undefined : year
}

/** The one sentence a date outside the supported range gets, naming the range and the reason. */
export function unsupportedYearMessage(year: string): string {
	return `The year ${year} is outside ${FIRST_SUPPORTED_YEAR}-${LAST_SUPPORTED_YEAR}; dates are Gregorian YYYY-MM-DD, so a Buddhist year is 543 later.`
}

/** The `INVALID_DATE` an outside year gets, or `null` when the year is inside the range. */
export function yearFailure(value: string, path: string): AppError | null {
	const year = unsupportedYear(value)
	if (year === undefined) return null
	return fail("INVALID_DATE", { path, message: unsupportedYearMessage(year) })
}
