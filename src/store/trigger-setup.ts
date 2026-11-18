import { Database } from "bun:sqlite"
import { chmodSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { capture } from "../test-support"
import { guardAt } from "./guard"
import { openStore } from "./index"
import { ledgerHome, mustOpen, steppingClock, tempHome } from "./testing"

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
	const home = ledgerHome()
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

/** An `openStore` on a TRAJ_HOME that is a file, never a directory. */
export function fileHome(): unknown {
	const home = tempHome()
	mkdirSync(join(home, ".."), { recursive: true })
	writeFileSync(home, "")
	return openStore({ env: { TRAJ_HOME: home }, clock: steppingClock() })
}

/** An `openStore` on a data directory the user cannot write. */
export function readonlyHome(): unknown {
	const home = ledgerHome()
	chmodSync(home, 0o500)
	try {
		return openStore({ env: { TRAJ_HOME: home }, clock: steppingClock() })
	} finally {
		chmodSync(home, 0o700)
	}
}

/** An `openStore` on a file that is not a SQLite database. */
export function corruptHome(): unknown {
	const home = tempHome()
	mkdirSync(home, { recursive: true })
	writeFileSync(join(home, "traj.db"), "not a sqlite database")
	return openStore({ env: { TRAJ_HOME: home }, clock: steppingClock() })
}

/** The envelope `guardAt` returns on a full disk, without needing a full disk. */
export function fullDisk(): unknown {
	return guardAt(join(tempHome(), "traj.db"), () => {
		throw Object.assign(new Error("database or disk is full"), { code: "SQLITE_FULL" })
	})
}
