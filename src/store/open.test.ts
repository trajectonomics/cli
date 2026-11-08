import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { isAppError } from "../errors"
import { capture } from "../test-support"
import { HEAD, openStore } from "./index"
import { mustOpen, steppingClock, tempHome } from "./testing"

/**
 * One builder per schema version below head, each producing what that version left on disk.
 * Adding a migration step fails the coverage test below until its predecessor gets a fixture.
 */
const fixtures: Record<number, (home: string) => Promise<void>> = {
	// Version 0 is exactly what `traj init` leaves behind: an empty WAL database.
	0: async (home) => {
		expect((await capture(["init"], { TRAJ_HOME: home })).code).toBe(0)
	},
}

function setUserVersion(home: string, version: number) {
	const db = new Database(join(home, "traj.db"))
	db.run(`PRAGMA user_version = ${version}`)
	db.close()
}

function inspect(home: string) {
	const db = new Database(join(home, "traj.db"), { readonly: true })
	const version = db.query<{ user_version: number }, []>("PRAGMA user_version").get()
	const objects = db
		.query<{ type: string; name: string }, []>(
			"SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name",
		)
		.all()
	db.close()
	return { version: version?.user_version, objects }
}

describe("openStore", () => {
	it("migrates a fresh directory to head with all five tables and their indexes", () => {
		const home = tempHome()
		mustOpen(home).close()
		const { version, objects } = inspect(home)
		expect(version).toBe(HEAD)
		expect(objects.filter((o) => o.type === "table").map((o) => o.name)).toEqual([
			"account",
			"entity",
			"posting",
			"scenario",
			"tx",
		])
		expect(objects.filter((o) => o.type === "index").map((o) => o.name)).toEqual([
			"account_live_name",
			"account_parent",
			"posting_account",
			"scenario_live_name",
			"tx_entity_date",
			"tx_external_ref",
			"tx_linked_to",
		])
	})

	it("has a fixture for every version below head", () => {
		expect(Object.keys(fixtures).map(Number)).toEqual([...Array(HEAD).keys()])
	})

	it("migrates a fixture database at each earlier version to head", async () => {
		for (const [version, build] of Object.entries(fixtures)) {
			const home = tempHome()
			await build(home)
			expect(inspect(home).version).toBe(Number(version))
			mustOpen(home).close()
			expect(inspect(home).version).toBe(HEAD)
		}
	})

	it("changes nothing when re-opened at head", () => {
		const home = tempHome()
		mustOpen(home).close()
		const before = readFileSync(join(home, "traj.db"))
		mustOpen(home).close()
		expect(readFileSync(join(home, "traj.db")).equals(before)).toBe(true)
	})

	it("refuses a database newer than head and leaves the file untouched", async () => {
		const home = tempHome()
		await capture(["init"], { TRAJ_HOME: home })
		setUserVersion(home, HEAD + 1)
		const before = readFileSync(join(home, "traj.db"))
		const store = openStore({ env: { TRAJ_HOME: home }, clock: steppingClock() })
		if (!isAppError(store)) throw new Error("expected database_too_new")
		expect(store.body.code).toBe("database_too_new")
		expect(store.body.exitCode).toBe(5)
		expect(store.body.details).toEqual({ version: HEAD + 1, head: HEAD })
		expect(readFileSync(join(home, "traj.db")).equals(before)).toBe(true)
	})
	it("reports a failed step with fixed text and only the stable version fields", async () => {
		const home = tempHome()
		await capture(["init"], { TRAJ_HOME: home })
		const db = new Database(join(home, "traj.db"))
		db.run("CREATE TABLE account (x)")
		db.close()
		const store = openStore({ env: { TRAJ_HOME: home }, clock: steppingClock() })
		if (!isAppError(store)) throw new Error("expected migration_failed")
		expect(store.body).toEqual({
			code: "migration_failed",
			exitCode: 1,
			message: "Migrating the database from schema version 0 to 1 failed; it was left at 0.",
			details: { from: 0, to: 1 },
		})
	})
})
