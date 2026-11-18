import { type Database, SQLiteError } from "bun:sqlite"
import { LedgerValidationError } from "@trajectonomics/ledger"
import { type AppError, fail, isAppError } from "../errors"
import { databaseFailure } from "./io-errors"
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
/** The failures `guard` knows without a database path; anything else is rethrown. */
function knownFailure(error: unknown): AppError | undefined {
	if (error instanceof Abort) return error.error
	if (error instanceof LedgerValidationError) return fromLedgerError(error)
	if (isBusy(error)) {
		return fail("database_busy", {
			details: { retryable: true },
			hint: "Another traj process is writing; retry the command.",
		})
	}
	return undefined
}

function run<T>(work: () => T | AppError, path: string | undefined): T | AppError {
	try {
		return work()
	} catch (error) {
		const known = knownFailure(error)
		if (known !== undefined) return known
		const failure = path === undefined ? undefined : databaseFailure(path, error)
		if (failure !== undefined) return failure
		throw error
	}
}

/** The store's failure convention for work that does not touch the database file. */
export function guard<T>(work: () => T | AppError): T | AppError {
	return run(work, undefined)
}

/** `guard` for one step that touches `path`: a filesystem refusal carries that path. */
export function guardAt<T>(path: string, work: () => T | AppError): T | AppError {
	return run(work, path)
}

/** `guard` for one step on `db`, so every database read maps its I/O failure. */
export function read<T>(db: Database, work: () => T | AppError): T | AppError {
	return guardAt(db.filename, work)
}

/** Runs `work` inside one IMMEDIATE transaction; an `AppError` result rolls it back. */
export function write<T>(
	db: Database,
	work: () => T | AppError,
	options: WriteOptions = {},
): T | AppError {
	return guardAt(db.filename, () => {
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
