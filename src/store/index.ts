import { existsSync, statSync } from "node:fs"
import type { Env } from "../command"
import { type AppError, type ErrorCode, fail, isAppError } from "../errors"
import { connect } from "./connection"
import { PERSONAL_ENTITY_ID } from "./ids"
import { notADirectory } from "./io-errors"
import { directoryStep } from "./io-steps"
import { ledgerPaths, privateLedger } from "./ledger-file"
import { storeOver } from "./store"
import type { Clock, Store } from "./types"

export { ACCOUNT_TYPES, isAccountType } from "./accounts"
export { contentHash } from "./canonical"
export { PERSONAL_ENTITY_ID } from "./ids"
export { LEDGER_READ_CODES } from "./ledger"
export { fromLedgerError, ledgerFailure } from "./ledger-errors"
export { HEAD } from "./migrations"
export { formatMinorUnits, parseMinorUnits, supportedCurrency } from "./money"
export { isTxCorrection, TX_CORRECTIONS } from "./rows"
export { canonicalScenarioDocument } from "./scenario-rows"
export { importRejections } from "./tx-import"
export type * from "./types"

/**
 * Every code that opening an existing ledger can raise, for the leaves whose subject is the data
 * directory: `inspect`, `export` and `backup` declare it whole. A Command that only needs the
 * ledger declares none of them: its failure is the same one whether the ledger is missing,
 * unwritable or corrupt.
 */
export const LEDGER_OPEN_CODES: readonly ErrorCode[] = [
	"ledger_missing",
	"not_a_directory",
	"permission_denied",
	"database_corrupt",
	"database_too_new",
	"database_busy",
	"disk_full",
	"migration_failed",
]

export type StoreOptions = {
	env: Env
	clock: Clock
	/** How long a write waits for another writer before `database_busy`. Defaults to 5000. */
	busyTimeoutMs?: number
}

/** The one failure for a data directory that holds no ledger, naming the file `init` creates. */
function ledgerMissing(database: string): AppError {
	return fail("ledger_missing", {
		message: `No ledger at ${database}.`,
		hint: 'Run "traj init" to create one.',
	})
}

/**
 * Opens `traj.db` in the data directory and migrates it to head. It never creates one: `traj init`
 * and `traj restore` are the only creators, so a Command that finds no ledger fails with
 * `ledger_missing` instead of answering from an empty database. The store owns the connection
 * until `close()`.
 */
export function openStore(options: StoreOptions): Store | AppError {
	const paths = ledgerPaths(options.env)
	const kind = directoryStep(paths.directory, () =>
		statSync(paths.directory, { throwIfNoEntry: false }),
	)
	if (isAppError(kind)) return kind
	if (kind !== undefined && !kind.isDirectory()) return notADirectory(paths.directory)
	if (!existsSync(paths.database)) return ledgerMissing(paths.database)
	const db = connect(paths.database, options.busyTimeoutMs ?? 5000)
	if (isAppError(db)) return db
	const restricted = privateLedger(paths)
	if (isAppError(restricted)) {
		db.close()
		return restricted
	}
	return storeOver(paths.database, {
		db,
		clock: options.clock,
		entityId: PERSONAL_ENTITY_ID,
	})
}
