import { Database } from "bun:sqlite"
import { join } from "node:path"
import { capture } from "../test-support"
import { openStore } from "./index"
import { mustOpen, steppingClock, tempHome } from "./testing"

/** A trigger returns what the store returned; the contract test asserts it is an AppError. */
export type Trigger = () => unknown | Promise<unknown>

/** An `init`ed database mutated behind the store's back, then opened. */
export function openAt(prepare: (db: Database) => void): Trigger {
	return async () => {
		const home = tempHome()
		await capture(["init"], { TRAJ_HOME: home })
		const db = new Database(join(home, "traj.db"))
		prepare(db)
		db.close()
		return openStore({ env: { TRAJ_HOME: home }, clock: steppingClock() })
	}
}

/** A writer that holds the lock past a one-millisecond busy timeout. */
export function busy(): unknown {
	const home = tempHome()
	mustOpen(home).close()
	const holder = new Database(join(home, "traj.db"))
	holder.run("BEGIN IMMEDIATE")
	const store = openStore({ env: { TRAJ_HOME: home }, clock: steppingClock(), busyTimeoutMs: 1 })
	const outcome =
		"path" in store ? store.createAccount({ name: "X", type: "asset", currency: "THB" }) : store
	holder.run("ROLLBACK")
	holder.close()
	return outcome
}
