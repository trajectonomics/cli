import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import {
	chmodSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { capture } from "./test-support"

describe("init", () => {
	function tempHome() {
		return join(mkdtempSync(join(tmpdir(), "traj-test-")), "home")
	}

	it("creates the data directory and a WAL database with no tables", async () => {
		const home = tempHome()
		const res = await capture(["init", "--json"], { TRAJ_HOME: home })
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toEqual({
			directory: home,
			database: join(home, "traj.db"),
			created: true,
		})
		const db = new Database(join(home, "traj.db"), { readonly: true })
		expect(db.query("PRAGMA journal_mode").get()).toEqual({ journal_mode: "wal" })
		expect(db.query("PRAGMA user_version").get()).toEqual({ user_version: 0 })
		expect(db.query("SELECT name FROM sqlite_master").all()).toEqual([])
		db.close()
	})

	it("is idempotent: the second run exits 0 and changes nothing", async () => {
		const home = tempHome()
		await capture(["init"], { TRAJ_HOME: home })
		const before = readFileSync(join(home, "traj.db"))
		const listing = readdirSync(home)
		const res = await capture(["init", "--json"], { TRAJ_HOME: home })
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out).created).toBe(false)
		expect(readFileSync(join(home, "traj.db")).equals(before)).toBe(true)
		expect(readdirSync(home)).toEqual(listing)
	})

	it("names a TRAJ_HOME that is a file as not a directory", async () => {
		const file = join(mkdtempSync(join(tmpdir(), "traj-test-")), "afile")
		writeFileSync(file, "")
		const res = await capture(["init", "--json"], { TRAJ_HOME: file })
		expect(res.code).toBe(1)
		expect(res.out).toBe("")
		const { error } = JSON.parse(res.err)
		expect(error.code).toBe("not_a_directory")
		expect(error.exitCode).toBe(1)
		expect(error.message).toContain(file)
		expect(error.hint).toContain("TRAJ_HOME")
		expect(error.details).toEqual({ path: file })
	})

	it("names a data directory it cannot write as permission denied", async () => {
		const home = tempHome()
		mkdirSync(home, { recursive: true })
		chmodSync(home, 0o500)
		try {
			const res = await capture(["init", "--json"], { TRAJ_HOME: home })
			expect(res.code).toBe(1)
			expect(res.out).toBe("")
			const { error } = JSON.parse(res.err)
			expect(error.code).toBe("permission_denied")
			expect(error.exitCode).toBe(1)
			expect(error.message).toContain(join(home, "traj.db"))
			expect(error.hint).toContain("permission")
			expect(error.details).toEqual({ path: join(home, "traj.db") })
		} finally {
			chmodSync(home, 0o700)
		}
	})

	it("names a file that is not a database as corrupt", async () => {
		const home = tempHome()
		mkdirSync(home, { recursive: true })
		writeFileSync(join(home, "traj.db"), "not a sqlite database")
		const res = await capture(["init", "--json"], { TRAJ_HOME: home })
		expect(res.code).toBe(1)
		expect(res.out).toBe("")
		const { error } = JSON.parse(res.err)
		expect(error.code).toBe("database_corrupt")
		expect(error.exitCode).toBe(1)
		expect(error.message).toContain(join(home, "traj.db"))
		expect(error.hint).toContain("traj init")
		expect(error.details).toEqual({ path: join(home, "traj.db") })
	})
})
