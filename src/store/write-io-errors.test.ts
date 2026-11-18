import { describe, expect, it } from "bun:test"
import { chmodSync } from "node:fs"
import { join } from "node:path"
import { isAppError } from "../errors"
import { guardAt } from "./guard"
import { ledgerHome, mustOpen } from "./testing"

describe("a write refused by the filesystem", () => {
	it("names a read-only database through the store itself", () => {
		const home = ledgerHome()
		mustOpen(home).close()
		chmodSync(join(home, "traj.db"), 0o444)
		const store = mustOpen(home)
		try {
			const outcome = store.createAccount({ name: "Cash", type: "asset", currency: "THB" })
			if (!isAppError(outcome)) throw new Error("expected permission_denied")
			expect(outcome.body).toMatchObject({
				code: "permission_denied",
				exitCode: 1,
				details: { path: join(home, "traj.db") },
			})
		} finally {
			chmodSync(join(home, "traj.db"), 0o600)
			store.close()
		}
	})

	it("names a full disk as a retryable disk_full", () => {
		const path = join(ledgerHome(), "traj.db")
		const outcome = guardAt(path, () => {
			throw Object.assign(new Error("database or disk is full"), { code: "SQLITE_FULL" })
		})
		if (!isAppError(outcome)) throw new Error("expected disk_full")
		expect(outcome.body).toMatchObject({ code: "disk_full", exitCode: 1, details: { path } })
		expect(outcome.body.hint).toContain("Free space")
	})

	it("leaves an unknown failure to the internal envelope", () => {
		expect(() =>
			guardAt(join(ledgerHome(), "traj.db"), () => {
				throw new Error("boom")
			}),
		).toThrow("boom")
	})
})
