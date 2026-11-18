import type { AppError } from "../errors"
import { databaseFailure, directoryFailure, fileFailure } from "./io-errors"

/**
 * Runs one `node:fs` step on a ledger file and returns its typed failure instead of throwing it.
 * `databaseStep` reads `bun:sqlite`'s codes; `chmodSync` and its neighbours throw POSIX errno.
 */
export function fileStep(path: string, work: () => void): AppError | undefined {
	try {
		work()
		return undefined
	} catch (error) {
		const failure = fileFailure(path, error)
		if (failure !== undefined) return failure
		throw error
	}
}

/** Runs one filesystem step and returns its typed failure instead of throwing it. */
export function directoryStep<T>(directory: string, work: () => T): T | AppError {
	try {
		return work()
	} catch (error) {
		const failure = directoryFailure(directory, error)
		if (failure !== undefined) return failure
		throw error
	}
}

/** Runs one database-file step and returns its typed failure instead of throwing it. */
export function databaseStep<T>(path: string, work: () => T): T | AppError {
	try {
		return work()
	} catch (error) {
		const failure = databaseFailure(path, error)
		if (failure !== undefined) return failure
		throw error
	}
}
