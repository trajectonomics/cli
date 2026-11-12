import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type AppError, isAppError } from "../errors"
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
export function must<T>(outcome: T): Exclude<T, AppError> {
	if (isAppError(outcome)) throw new Error(JSON.stringify(outcome.body))
	return outcome as Exclude<T, AppError>
}

/**
 * One valid Scenario v1 document, shared by every test that stores a Scenario: an asset, a
 * liability, two incomes and a routed surplus. Tests spread it and change one field.
 */
export const SCENARIO_DOCUMENT = {
	schemaVersion: 1,
	currency: "THB",
	economy: { inflation: 0 },
	accounts: [
		{ id: "cash", kind: "asset", rate: 0 },
		{ id: "loan", kind: "liability", rate: 0 },
	],
	flows: [
		{
			id: "salary",
			kind: "income",
			earned: true,
			amount: 100_000,
			frequency: "monthly",
			start: "2026-01-01",
			growth: "inflation",
		},
		{
			id: "bonus",
			kind: "income",
			earned: true,
			amount: 5_000,
			frequency: "annual",
			start: "2026-01-01",
			growth: "inflation",
		},
	],
	cashflow: { surplus: [{ account: "cash" }], withdraw: ["cash"] },
} as const
