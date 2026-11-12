import type { ISODate } from "@trajectonomics/ledger"
import { LedgerValidationError, parseISODate } from "@trajectonomics/ledger"
import type { AppError } from "../errors"
import { ledgerFailure } from "../store"

/**
 * The As-of checked before the Ledger is read, so a bad date wins over a corrupt stored
 * Transaction, and the path names the caller's flag rather than the core's own field.
 */
export function checkedAsOf(asOf: string): ISODate | AppError {
	try {
		return parseISODate(asOf, "asOf")
	} catch (error) {
		if (!(error instanceof LedgerValidationError)) throw error
		return ledgerFailure(error, "asOf")
	}
}
