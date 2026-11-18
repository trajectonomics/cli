import { existsSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { skipped, step } from "./checks"
import type { DoctorCheck } from "./output"

export type DirectoryFacts = { path: string; exists: boolean; writable: boolean }

/**
 * Writes and removes one file. `access(W_OK)` answers about the directory's mode, which is not
 * the whole truth once an ACL or a read-only mount is involved; a real write is.
 */
function probeWritable(directory: string): boolean {
	const probe = join(directory, `.traj-doctor-${crypto.randomUUID()}`)
	try {
		writeFileSync(probe, "")
	} catch {
		return false
	}
	try {
		unlinkSync(probe)
	} catch {
		// The write is what the check asks about; a probe left behind is cleanup, not a failure.
	}
	return true
}

function directoryCheck(directory: string, exists: boolean): DoctorCheck {
	return step(
		"directory",
		exists ? "pass" : "fail",
		exists ? `${directory} exists.` : `${directory} does not exist; run "traj init".`,
	)
}

function writableCheck(exists: boolean, writable: boolean): DoctorCheck {
	if (!exists) return skipped("writable", "The data directory does not exist.")
	return step(
		"writable",
		writable ? "pass" : "fail",
		writable
			? "A file could be written and removed."
			: "Nothing could be written; the data directory is not writable.",
	)
}

/** The data directory's own two checks, and the facts the result states about it. */
export function directoryChecks(directory: string): {
	facts: DirectoryFacts
	checks: DoctorCheck[]
} {
	const exists = existsSync(directory)
	const writable = exists && probeWritable(directory)
	return {
		facts: { path: directory, exists, writable },
		checks: [directoryCheck(directory, exists), writableCheck(exists, writable)],
	}
}
