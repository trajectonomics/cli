import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { chmodSync, existsSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import pkg from "../package.json"
import { goldenHome } from "./interchange/testing"
import { FIXTURE_AS_OF, fixtureHome } from "./ledger-fixture"
import { tempHome } from "./store/testing"
import { capture, errorOf } from "./test-support"

const GOLDEN = { entity: 1, account: 7, tx: 4, posting: 8, scenario: 3 }

const doctor = (home: string, ...flags: string[]) =>
	capture(["doctor", ...flags, "--json"], { TRAJ_HOME: home })

/** The first posting, changed behind the CLI's back: the ledger core must reject the transaction. */
function tamper(path: string): void {
	const db = new Database(path)
	db.run("UPDATE posting SET amount = amount + 1 WHERE ordinal = 0")
	db.close()
}

describe("doctor", () => {
	it("reports a healthy data directory, database and ledger with every check it ran", async () => {
		const home = await goldenHome()
		const res = await doctor(home)
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.ok).toBe(true)
		expect(data.cliVersion).toBe(pkg.version)
		expect(data.directory).toEqual({ path: home, exists: true, writable: true })
		expect(data.database).toMatchObject({
			path: join(home, "traj.db"),
			exists: true,
			schemaVersion: 2,
			head: 2,
		})
		expect(data.database.bytes).toBeGreaterThan(0)
		expect(data.rows).toEqual(GOLDEN)
		expect(data.checks.map((check: { name: string }) => check.name)).toEqual([
			"directory",
			"writable",
			"database",
			"integrity",
			"ledger",
			"trialBalance",
		])
		expect(
			data.checks.slice(0, -1).every((check: { status: string }) => check.status === "pass"),
		).toBe(true)
		expect(data.checks.at(-1)).toMatchObject({ name: "trialBalance", status: "skipped" })
		expect(data.trialBalance).toBeUndefined()
	})

	it("adds the Trial Balance when --as-of names a date", async () => {
		const res = await doctor(fixtureHome(), "--as-of", FIXTURE_AS_OF)
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.trialBalance).toEqual({
			asOf: FIXTURE_AS_OF,
			totals: [{ currency: "THB", debit: "1155000.00", credit: "1155000.00" }],
			balanced: true,
		})
		expect(data.checks.at(-1)).toMatchObject({ name: "trialBalance", status: "pass" })
		expect(data.ok).toBe(true)
	})

	it("answers a bad --as-of as the input error it is, like every dated read", async () => {
		const res = await doctor(await goldenHome(), "--as-of", "2026-02-30")
		expect(res.code).toBe(3)
		expect(errorOf(res).code).toBe("INVALID_DATE")
	})

	it("reports a data directory that does not exist and creates nothing", async () => {
		const home = tempHome()
		const res = await doctor(home)
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.ok).toBe(false)
		expect(data.directory).toEqual({ path: home, exists: false, writable: false })
		expect(data.database).toMatchObject({
			path: join(home, "traj.db"),
			exists: false,
			schemaVersion: null,
		})
		expect(data.rows).toEqual({ entity: 0, account: 0, tx: 0, posting: 0, scenario: 0 })
		expect(data.checks.find((check: { name: string }) => check.name === "database").status).toBe(
			"fail",
		)
		expect(existsSync(home)).toBe(false)
	})

	it("reports a directory nothing can be written into", async () => {
		const home = tempHome()
		mkdirSync(home, { recursive: true })
		chmodSync(home, 0o500)
		try {
			const data = JSON.parse((await doctor(home)).out)
			expect(data.directory.writable).toBe(false)
			expect(data.ok).toBe(false)
			expect(data.checks.find((check: { name: string }) => check.name === "writable").status).toBe(
				"fail",
			)
		} finally {
			chmodSync(home, 0o700)
		}
	})

	it("reports a ledger the core rejects, as a finding and not as a failure", async () => {
		const home = fixtureHome()
		tamper(join(home, "traj.db"))
		const res = await doctor(home)
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.ok).toBe(false)
		const ledger = data.checks.find((check: { name: string }) => check.name === "ledger")
		expect(ledger.status).toBe("fail")
		expect(ledger.detail).toContain("UNBALANCED_TRANSACTION")
		expect(data.checks.find((check: { name: string }) => check.name === "integrity").status).toBe(
			"pass",
		)
	})

	it("names every check it knows when it could not run them", async () => {
		const data = JSON.parse((await doctor(tempHome())).out)
		expect(data.checks.map((check: { name: string }) => check.name)).toEqual([
			"directory",
			"writable",
			"database",
			"integrity",
			"ledger",
			"trialBalance",
		])
	})

	it("gives byte-identical output for two runs over the same data", async () => {
		const home = await goldenHome()
		expect(await doctor(home)).toEqual(await doctor(home))
	})

	it("describes itself in the human Format too", async () => {
		const home = await goldenHome()
		const res = await capture(["doctor"], { TRAJ_HOME: home })
		expect(res.code).toBe(0)
		expect(res.out).toContain("ok: true")
		expect(res.out).toContain(`path: ${home}`)
		expect(res.out).toContain("checks:")
		expect(res.out).toContain("trialBalance")
	})
})
