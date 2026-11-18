import type { ISODate } from "@trajectonomics/ledger"
import { LedgerValidationError, parseISODate } from "@trajectonomics/ledger"
import { type AppError, fail } from "./errors"
import { ledgerFailure } from "./store"

/**
 * The Gregorian years the CLI accepts in a caller's date. A Buddhist year is 543 ahead, so a date
 * typed in the Thai calendar lands here as 2569 and is refused instead of silently projected as
 * the year 2569 (cli#150).
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

/**
 * A date taken from the caller, checked before anything is read, so a bad date wins over a
 * corrupt stored Transaction. Its `path` is the schema field the caller passed, not the flag:
 * ADR-0013's input-path rule binds `invalid_input`, and `INVALID_DATE` follows in a later change.
 */
export function checkedDate(value: string, path: string): ISODate | AppError {
	try {
		return parseISODate(value, path)
	} catch (error) {
		if (!(error instanceof LedgerValidationError)) throw error
		return ledgerFailure(error, path)
	}
}

/**
 * The same check for an As-of, which every read states at `asOf`, plus the supported year range:
 * an As-of is the year the CLI projects, so a Buddhist year typed as 2569 is refused there rather
 * than projected as the year 2569 (cli#150). A birth date keeps the Ledger's own range.
 */
export function checkedAsOf(asOf: string): ISODate | AppError {
	const year = unsupportedYear(asOf)
	if (year !== undefined) {
		return fail("INVALID_DATE", { path: "asOf", message: unsupportedYearMessage(year) })
	}
	return checkedDate(asOf, "asOf")
}
