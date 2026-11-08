import { Database } from "bun:sqlite"
import { type AppError, isAppError } from "../errors"
import { guard } from "./guard"
import { HEAD, migrate, tooNew, userVersion } from "./migrations"

/**
 * Opens one connection with the pragmas every connection needs, refusing a database newer than
 * head before anything could write to it, then migrates to head.
 */
export function connect(path: string, busyTimeoutMs: number): Database | AppError {
	const db = new Database(path, { create: true })
	const outcome = guard(() => {
		db.run(`PRAGMA busy_timeout = ${busyTimeoutMs}`)
		const version = userVersion(db)
		if (version > HEAD) return tooNew(version)
		db.run("PRAGMA journal_mode = WAL")
		db.run("PRAGMA foreign_keys = ON")
		return migrate(db)
	})
	if (isAppError(outcome)) {
		db.close()
		return outcome
	}
	return db
}
