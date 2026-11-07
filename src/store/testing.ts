import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { isAppError } from "../errors"
import { openStore } from "./index"
import type { Clock, Store } from "./types"

/** A data directory that does not exist yet, inside a fresh temporary folder. */
export function tempHome(): string {
	return join(mkdtempSync(join(tmpdir(), "traj-store-")), "home")
}

/** A clock that starts at a fixed instant and advances one second per reading. */
export function steppingClock(start = "2026-01-01T00:00:00.000Z"): Clock {
	let next = Date.parse(start)
	return () => {
		const now = new Date(next)
		next += 1000
		return now
	}
}

/** Opens a store or fails the test with the error envelope. */
export function mustOpen(home: string, clock: Clock = steppingClock()): Store {
	const store = openStore({ env: { TRAJ_HOME: home }, clock })
	if (isAppError(store)) throw new Error(JSON.stringify(store.body))
	return store
}

/** Unwraps a store outcome or fails the test with the error envelope. */
export function must<T>(outcome: T): Exclude<T, import("../errors").AppError> {
	if (isAppError(outcome)) throw new Error(JSON.stringify(outcome.body))
	return outcome as Exclude<T, import("../errors").AppError>
}
