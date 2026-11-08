import { type Database, SQLiteError } from "bun:sqlite"
import { LedgerValidationError } from "@trajectonomics/ledger"
import { type AppError, fail, isAppError } from "../errors"
import { fromLedgerError } from "./ledger-errors"
import type { WriteOptions } from "./types"

// Carries an expected failure out of a transaction callback so the transaction rolls back.
class Abort extends Error {
	readonly error: AppError
	constructor(error: AppError) {
		super(error.body.message)
		this.error = error
	}
}

// Carries a dry run's outcome out of the transaction so Bun rolls it back, then returns it.
class Rollback {
	readonly value: unknown
	constructor(value: unknown) {
		this.value = value
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
export function write<T>(
	db: Database,
	work: () => T | AppError,
	options: WriteOptions = {},
): T | AppError {
	return guard(() => {
		try {
			return db
				.transaction(() => {
					const outcome = work()
					if (isAppError(outcome)) abort(outcome)
					// A dry run executes every write, then rolls the whole transaction back (ADR-0019).
					if (options.dryRun === true) throw new Rollback(outcome)
					return outcome
				})
				.immediate()
		} catch (error) {
			if (error instanceof Rollback) return error.value as T
			throw error
		}
	})
}
