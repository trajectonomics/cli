import { mkdirSync } from "node:fs"
import { join } from "node:path"
import type { Env } from "../command"
import { dataDirectory } from "../data-directory"
import { type AppError, isAppError } from "../errors"
import { connect } from "./connection"
import { PERSONAL_ENTITY_ID } from "./ids"
import { storeOver } from "./store"
import type { Clock, Store } from "./types"

export { contentHash } from "./canonical"
export { PERSONAL_ENTITY_ID } from "./ids"
export { fromLedgerError } from "./ledger-errors"
export { HEAD } from "./migrations"
export { formatMinorUnits, parseMinorUnits } from "./money"
export { canonicalScenarioDocument } from "./scenario-rows"
export type * from "./types"

export type StoreOptions = {
	env: Env
	clock: Clock
	/** How long a write waits for another writer before `database_busy`. Defaults to 5000. */
	busyTimeoutMs?: number
}

/**
 * Opens `traj.db` in the data directory, creating the directory if needed, and migrates it to
 * head. The returned store owns the connection until `close()`.
 */
export function openStore(options: StoreOptions): Store | AppError {
	const directory = dataDirectory(options.env)
	mkdirSync(directory, { recursive: true })
	const path = join(directory, "traj.db")
	const db = connect(path, options.busyTimeoutMs ?? 5000)
	if (isAppError(db)) return db
	return storeOver(path, { db, clock: options.clock, entityId: PERSONAL_ENTITY_ID })
}
