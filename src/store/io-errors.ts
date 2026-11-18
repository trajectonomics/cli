import { errorCodeOf } from "../error-code"
import { type AppError, fail } from "../errors"

function permissionDenied(path: string, kind: "directory" | "database"): AppError {
	const hint =
		kind === "directory"
			? "Check the directory's permissions, or set TRAJ_HOME to a writable directory."
			: 'Check the file\'s permissions, or move it aside and run "traj init" to start a new database.'
	return fail("permission_denied", {
		message: `Permission denied for ${path}`,
		hint,
		details: { path },
	})
}

function notADirectory(path: string): AppError {
	return fail("not_a_directory", {
		message: `The path is not a directory: ${path}`,
		hint: "Move the file, or set TRAJ_HOME to a directory.",
		details: { path },
	})
}

function databaseCorrupt(path: string): AppError {
	return fail("database_corrupt", {
		message: `The database is not a valid SQLite database: ${path}`,
		hint: 'Move it aside and run "traj init" to start a new database.',
		details: { path },
	})
}

function diskFull(path: string): AppError {
	return fail("disk_full", {
		message: `The disk is full: ${path}`,
		hint: "Free space and retry the command (traj needs about 100 MB for a new database).",
		details: { path },
	})
}

/**
 * One filesystem failure in the data directory as a typed failure, or `undefined` when the
 * error is not one this module knows: anything else stays a programming error (`internal`).
 */
export function directoryFailure(directory: string, error: unknown): AppError | undefined {
	switch (errorCodeOf(error)) {
		case "EACCES":
		case "EPERM":
		case "EROFS":
			return permissionDenied(directory, "directory")
		case "ENOSPC":
		case "EDQUOT":
			return diskFull(directory)
		case "EEXIST":
		case "ENOTDIR":
		case "EISDIR":
			return notADirectory(directory)
		default:
			return undefined
	}
}

/** One `bun:sqlite` failure on the database file as a typed failure, or `undefined`. */
export function databaseFailure(path: string, error: unknown): AppError | undefined {
	switch (errorCodeOf(error)) {
		case "SQLITE_CANTOPEN":
		case "SQLITE_PERM":
		case "SQLITE_AUTH":
		case "SQLITE_READONLY":
			return permissionDenied(path, "database")
		case "SQLITE_NOTADB":
		case "SQLITE_CORRUPT":
			return databaseCorrupt(path)
		case "SQLITE_FULL":
			return diskFull(path)
		default:
			return undefined
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

/** True when the mapping names this filesystem failure, not a programming error. */
export function isFileFailure(error: unknown): boolean {
	return directoryFailure("", error) !== undefined || databaseFailure("", error) !== undefined
}
