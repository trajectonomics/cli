import type { ISODate } from "@trajectonomics/ledger"
import { LedgerValidationError, parseISODate } from "@trajectonomics/ledger"
import type { AppError } from "./errors"
import { ledgerFailure } from "./store"

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

/** The same check for an As-of, which every read states at `asOf`. */
export function checkedAsOf(asOf: string): ISODate | AppError {
	return checkedDate(asOf, "asOf")
}
