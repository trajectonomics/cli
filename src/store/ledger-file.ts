import { Database } from "bun:sqlite"
import { chmodSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import type { Env } from "../command"
import { DATABASE_FILE, dataDirectory } from "../data-directory"
import { type AppError, isAppError } from "../errors"
import { databaseStep, directoryStep, fileStep } from "./io-steps"

/** The data directory is created 0700: the ledger is someone's money, and nobody else enters it. */
const DIRECTORY_MODE = 0o700
/** The ledger and its side files are 0600: plaintext SQLite of money is the owner's alone. */
const FILE_MODE = 0o600

export type LedgerPaths = { directory: string; database: string }

/** Where the ledger lives: `traj.db` in the data directory `TRAJ_HOME` or `~/.traj` names. */
export function ledgerPaths(env: Env): LedgerPaths {
	const directory = dataDirectory(env)
	return { directory, database: join(directory, DATABASE_FILE) }
}

/**
 * Owns the modes of the ledger and the two files SQLite writes beside it. `-wal` and `-shm`
 * exist only while a connection is open, so this runs after the connection is up.
 */
export function privateLedger(paths: LedgerPaths): AppError | undefined {
	return fileStep(paths.database, () => {
		for (const suffix of ["", "-wal", "-shm"]) {
			const file = `${paths.database}${suffix}`
			if (existsSync(file)) chmodSync(file, FILE_MODE)
		}
	})
}

export type CreatedLedger = LedgerPaths & { created: boolean }

/**
 * Creates the data directory and an empty ledger in it, and is the only thing that does: every
 * other Command opens a ledger and fails with `ledger_missing` when there is none, so a read
 * never invents an empty database (cli#146).
 */
export function createLedger(env: Env): CreatedLedger | AppError {
	const paths = ledgerPaths(env)
	const created = !existsSync(paths.database)
	const made = directoryStep(paths.directory, () =>
		mkdirSync(paths.directory, { recursive: true, mode: DIRECTORY_MODE }),
	)
	if (isAppError(made)) return made
	// Deliberately an empty database at `user_version` 0: the first `openStore()` migrates it to
	// head, so `init` never needs to know the schema. Setting WAL on a database that already has
	// it is a no-op, so a half-finished earlier run is repaired.
	const opened = databaseStep(paths.database, () => {
		const db = new Database(paths.database, { create: true })
		try {
			db.run("PRAGMA journal_mode = WAL")
		} finally {
			db.close()
		}
	})
	if (isAppError(opened)) return opened
	const restricted = privateLedger(paths)
	if (isAppError(restricted)) return restricted
	return { ...paths, created }
}
