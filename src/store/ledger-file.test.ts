import { describe, expect, it } from "bun:test"
import { chmodSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { isAppError } from "../errors"
import { openStore } from "./index"
import { createLedger, ledgerPaths } from "./ledger-file"
import { fileMode, ledgerHome, mustOpen, steppingClock, tempHome } from "./testing"

describe("the ledger's file", () => {
	it("refuses a data directory that holds no ledger, naming the file it wanted", () => {
		const home = tempHome()
		const store = openStore({ env: { TRAJ_HOME: home }, clock: steppingClock() })
		if (!isAppError(store)) throw new Error("expected ledger_missing")
		expect(store.body).toEqual({
			code: "ledger_missing",
			exitCode: 4,
			message: `No ledger at ${join(home, "traj.db")}.`,
			hint: 'Run "traj init" to create one.',
		})
		expect(existsSync(home)).toBe(false)
	})

	it("keeps an older release's world-readable ledger and its side files private", () => {
		const home = ledgerHome()
		chmodSync(join(home, "traj.db"), 0o644)
		const store = mustOpen(home)
		for (const file of ["traj.db", "traj.db-wal", "traj.db-shm"]) {
			expect(fileMode(join(home, file))).toBe(0o600)
		}
		store.close()
	})

	it("creates a new data directory 0700 and leaves an existing one's mode alone", () => {
		const created = ledgerPaths({ TRAJ_HOME: tempHome() }).directory
		createLedger({ TRAJ_HOME: created })
		expect(fileMode(created)).toBe(0o700)
		expect(fileMode(join(created, "traj.db"))).toBe(0o600)

		const existing = tempHome()
		mkdirSync(existing, { recursive: true })
		chmodSync(existing, 0o755)
		createLedger({ TRAJ_HOME: existing })
		expect(fileMode(existing)).toBe(0o755)
	})
})
