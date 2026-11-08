import { LedgerValidationError, parseISODate } from "@trajectonomics/ledger"
import { type AppError, fail } from "../errors"
import { fromLedgerError } from "../store"

/** A real `YYYY-MM-DD` bound, as the core defines it; the caller's flag is the path. */
export function dateError(value: string | undefined, field: string): AppError | undefined {
	if (value === undefined) return undefined
	try {
		parseISODate(value, field)
	} catch (error) {
		if (error instanceof LedgerValidationError) return fromLedgerError(error)
		throw error
	}
	return undefined
}

/** A start after its end is the core's `INVALID_PERIOD`, reported at the start's flag. */
export function periodError(
	since: string | undefined,
	until: string | undefined,
): AppError | undefined {
	if (since === undefined || until === undefined || since <= until) return undefined
	return fail("INVALID_PERIOD", {
		path: "since",
		message: `since: ${since} is after until ${until}`,
		details: { since, until },
	})
}
