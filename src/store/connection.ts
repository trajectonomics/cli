import { Database } from "bun:sqlite"
import { type AppError, isAppError } from "../errors"
import { guardAt } from "./guard"
import { HEAD, migrate, tooNew, userVersion } from "./migrations"

/**
 * Opens one connection with the pragmas every connection needs, refusing a database newer than
 * head before anything could write to it, then migrates to head. It never creates the file: the
 * caller has proved the ledger exists, because only `traj init` and `traj restore` create one.
 */
export function connect(path: string, busyTimeoutMs: number): Database | AppError {
	let db: Database | undefined
	try {
		const opened = guardAt(path, () => new Database(path, { create: false }))
		if (isAppError(opened)) return opened
		db = opened
		const outcome = guardAt(path, () => {
			opened.run(`PRAGMA busy_timeout = ${busyTimeoutMs}`)
			const version = userVersion(opened)
			if (version > HEAD) return tooNew(version)
			opened.run("PRAGMA journal_mode = WAL")
			opened.run("PRAGMA foreign_keys = ON")
			return migrate(opened)
		})
		if (isAppError(outcome)) {
			opened.close()
			return outcome
		}
		return opened
	} catch (error) {
		try {
			db?.close()
		} catch {
			// The connection is being abandoned; a close that also fails changes nothing.
		}
		throw error
	}
}
