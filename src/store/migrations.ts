import type { Database } from "bun:sqlite"
import { type AppError, fail } from "../errors"
import { abort, write } from "./guard"
import { schemaV1 } from "./schema-v1"
import { schemaV2 } from "./schema-v2"

/** Ordered, forward-only steps. Step `n` takes the database from version `n` to `n + 1`. */
const STEPS: readonly ((db: Database) => void)[] = [schemaV1, schemaV2]

/** The schema version this build writes: `PRAGMA user_version` after every step has run. */
export const HEAD: number = STEPS.length

export function userVersion(db: Database): number {
	return db.query<{ user_version: number }, []>("PRAGMA user_version").get()?.user_version ?? 0
}

export function tooNew(version: number): AppError {
	return fail("database_too_new", {
		message: `The database is at schema version ${version}; this traj understands up to ${HEAD}.`,
		hint: "Upgrade traj to a release that knows this schema version.",
		details: { version, head: HEAD },
	})
}

function runStep(db: Database, version: number, step: (db: Database) => void): void {
	try {
		step(db)
	} catch {
		// SQLite's own text varies by runtime and version, so only the stable fields are kept.
		const to = version + 1
		const message = `Migrating the database from schema version ${version} to ${to} failed; it was left at ${version}.`
		abort(fail("migration_failed", { message, details: { from: version, to } }))
	}
	db.run(`PRAGMA user_version = ${version + 1}`)
}

/**
 * Runs each missing step in its own IMMEDIATE transaction, re-reading the version inside it so
 * a concurrent opener that migrated first is never migrated over. A database already at head
 * takes no write lock at all.
 */
export function migrate(db: Database): undefined | AppError {
	while (userVersion(db) < HEAD) {
		const outcome = write(db, () => {
			const version = userVersion(db)
			if (version > HEAD) return tooNew(version)
			const step = STEPS[version]
			if (step !== undefined) runStep(db, version, step)
			return undefined
		})
		if (outcome !== undefined) return outcome
	}
	const version = userVersion(db)
	return version > HEAD ? tooNew(version) : undefined
}
