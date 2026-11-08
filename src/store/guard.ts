import { type Database, SQLiteError } from "bun:sqlite"
import { LedgerValidationError } from "@trajectonomics/ledger"
import { type AppError, fail, isAppError } from "../errors"
import { fromLedgerError } from "./ledger-errors"

// Carries an expected failure out of a transaction callback so the transaction rolls back.
class Abort extends Error {
	readonly error: AppError
	constructor(error: AppError) {
		super(error.body.message)
		this.error = error
	}
}

/** Throws inside a transaction to roll it back and surface `error` from `guard`. */
export function abort(error: AppError): never {
	throw new Abort(error)
}

function isBusy(error: unknown): boolean {
	return error instanceof SQLiteError && /^SQLITE_(BUSY|LOCKED)/.test(error.code ?? "")
}

/**
 * The store's one failure convention: every public method returns its value or an `AppError`
 * built by `fail()`, and never throws for an expected failure. Anything else is a bug and is
 * rethrown, so `run()` reports it as `internal`.
 */
export function guard<T>(work: () => T | AppError): T | AppError {
	try {
		return work()
	} catch (error) {
		if (error instanceof Abort) return error.error
		if (error instanceof LedgerValidationError) return fromLedgerError(error)
		if (isBusy(error)) {
			return fail("database_busy", {
				details: { retryable: true },
				hint: "Another traj process is writing; retry the command.",
			})
		}
		throw error
	}
}

/** Runs `work` inside one IMMEDIATE transaction; an `AppError` result rolls it back. */
export function write<T>(db: Database, work: () => T | AppError): T | AppError {
	return guard(() =>
		db
			.transaction(() => {
				const outcome = work()
				return isAppError(outcome) ? abort(outcome) : outcome
			})
			.immediate(),
	)
}
