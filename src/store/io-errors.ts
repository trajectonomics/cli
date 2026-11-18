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

/** The typed failure for a data directory path that exists as something other than a directory. */
export function notADirectory(path: string): AppError {
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

/** A refusal or a full disk, whichever hint the path kind calls for. */
function permissionOrFull(
	path: string,
	code: string | undefined,
	kind: "directory" | "database",
): AppError | undefined {
	switch (code) {
		case "EACCES":
		case "EPERM":
		case "EROFS":
			return permissionDenied(path, kind)
		case "ENOSPC":
		case "EDQUOT":
			return diskFull(path)
		default:
			return undefined
	}
}

/**
 * One filesystem failure in the data directory as a typed failure, or `undefined` when the
 * error is not one this module knows: anything else stays a programming error (`internal`).
 */
export function directoryFailure(directory: string, error: unknown): AppError | undefined {
	const code = errorCodeOf(error)
	const refused = permissionOrFull(directory, code, "directory")
	if (refused !== undefined) return refused
	switch (code) {
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
		case "SQLITE_READONLY_DIRECTORY":
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

/**
 * One `node:fs` failure on a ledger file as a typed failure, or `undefined` when it is not one
 * this module knows. `databaseFailure` reads `bun:sqlite`'s codes and `chmodSync` throws POSIX
 * errno, so a file step cannot use that mapping.
 */
export function fileFailure(path: string, error: unknown): AppError | undefined {
	return permissionOrFull(path, errorCodeOf(error), "database")
}

/** True when the mapping names this filesystem failure, not a programming error. */
export function isFileFailure(error: unknown): boolean {
	return directoryFailure("", error) !== undefined || databaseFailure("", error) !== undefined
}
