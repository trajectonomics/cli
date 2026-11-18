import type { ISODate } from "@trajectonomics/ledger"
import { LedgerValidationError, parseISODate } from "@trajectonomics/ledger"
import type { AppError } from "./errors"
import { ledgerFailure } from "./store"
import { yearFailure } from "./year"

export {
	FIRST_SUPPORTED_YEAR,
	LAST_SUPPORTED_YEAR,
	unsupportedYear,
	unsupportedYearMessage,
	yearFailure,
} from "./year"

/** The Ledger's own parse, without the year range: a birth date is historical by nature. */
export function checkedBirthDate(value: string, path: string): ISODate | AppError {
	try {
		return parseISODate(value, path)
	} catch (error) {
		if (!(error instanceof LedgerValidationError)) throw error
		return ledgerFailure(error, path)
	}
}

/**
 * A date taken from the caller, checked before anything is read, so a bad date wins over a
 * corrupt stored Transaction. Its `path` is the schema field the caller passed, not the flag:
 * ADR-0013's input-path rule binds `invalid_input`, and `INVALID_DATE` follows in a later change.
 * Every date flag takes this check, so a Buddhist year cannot become the year 2569 anywhere
 * (ADR-0036); only a birth date keeps the Ledger's own range.
 */
export function checkedDate(value: string, path: string): ISODate | AppError {
	const year = yearFailure(value, path)
	if (year !== null) return year
	return checkedBirthDate(value, path)
}

/** The same check for an As-of, which every read states at `asOf`. */
export function checkedAsOf(asOf: string): ISODate | AppError {
	return checkedDate(asOf, "asOf")
}
