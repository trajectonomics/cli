import { existsSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { type AppError, fail } from "../errors"

/** The one file a backup holds and a restore reads: the canonical JSONL dump (ADR-0028). */
export const BACKUP_FILE = "traj.jsonl"

function codeOf(error: unknown): string | undefined {
	const code = (error as { code?: unknown } | null)?.code
	return typeof code === "string" ? code : undefined
}

/** The file a backup path names: the path itself when it is a file, else `traj.jsonl` inside it. */
export function backupFileOf(path: string): string {
	const stat = statSync(path, { throwIfNoEntry: false })
	return stat?.isDirectory() === true ? join(path, BACKUP_FILE) : path
}

/**
 * Reads the backup at `path`, a directory holding `traj.jsonl` or the file itself. `field` is the
 * input the caller named, so the envelope's `path` is theirs rather than this module's. Text, not
 * bytes: the comparison and the restore both read it as UTF-8, exactly as it was written.
 */
export function readBackup(
	path: string,
	field: "source" | "backup",
): { file: string; text: string } | AppError {
	const file = resolve(backupFileOf(path))
	if (!existsSync(file)) {
		return fail("not_found", {
			path: field,
			message: `No backup file at ${file}.`,
			details: { file },
			hint: 'Run "traj backup --out <new dir>" to write one; it holds the canonical traj.jsonl.',
		})
	}
	try {
		return { file, text: readFileSync(file, "utf8") }
	} catch (error) {
		const code = codeOf(error)
		return fail("backup_unreadable", {
			path: field,
			message: `The backup could not be read: ${file}`,
			details: code === undefined ? { file } : { file, code },
			hint: "Check that the file is readable, then retry.",
		})
	}
}
