import { statSync } from "node:fs"
import { type AppError, fail } from "../errors"

/** The `code` an OS or SQLite error carries, without trusting its message. */
function codeOf(error: unknown): string | undefined {
	const code = (error as { code?: unknown } | null)?.code
	return typeof code === "string" ? code : undefined
}

function permissionDenied(path: string): AppError {
	return fail("permission_denied", {
		message: `Permission denied for ${path}`,
		hint: "Check its permissions; the path and its parent directory must be readable and writable, or set TRAJ_HOME to a writable directory.",
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

/** True when `path` already names a directory, so the database cannot be a file there. */
function isDirectory(path: string): boolean {
	try {
		return statSync(path).isDirectory()
	} catch {
		return false
	}
}

/**
 * One filesystem failure in the data directory as a typed failure, or `undefined` when the
 * error is not one this module knows: anything else stays a programming error (`internal`).
 */
export function directoryFailure(directory: string, error: unknown): AppError | undefined {
	switch (codeOf(error)) {
		case "EACCES":
		case "EPERM":
		case "EROFS":
			return permissionDenied(directory)
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
	switch (codeOf(error)) {
		case "SQLITE_CANTOPEN":
			return isDirectory(path) ? notADirectory(path) : permissionDenied(path)
		case "SQLITE_PERM":
		case "SQLITE_AUTH":
		case "SQLITE_READONLY":
			return permissionDenied(path)
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
