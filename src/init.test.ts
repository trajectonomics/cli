import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ACCOUNT_HINT } from "./hint"
import { fileMode, mustOpen, tempHome } from "./store/testing"
import { capture } from "./test-support"

describe("init", () => {
	it("creates the data directory and a WAL database with no tables", async () => {
		const home = tempHome()
		const res = await capture(["init", "--json"], { TRAJ_HOME: home })
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toEqual({
			directory: home,
			database: join(home, "traj.db"),
			created: true,
			hint: ACCOUNT_HINT,
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
		expect(JSON.parse(res.out)).toEqual({
			directory: home,
			database: join(home, "traj.db"),
			created: false,
		})
		expect(readFileSync(join(home, "traj.db")).equals(before)).toBe(true)
		expect(readdirSync(home)).toEqual(listing)
	})

	it("ends by naming the first account in the human Format too", async () => {
		const home = tempHome()
		const res = await capture(["init"], { TRAJ_HOME: home })
		expect(res.code).toBe(0)
		expect(res.out.split("\n")).toEqual([
			`directory: ${home}`,
			`database: ${join(home, "traj.db")}`,
			"created: true",
			`hint: ${ACCOUNT_HINT}`,
		])
	})

	it("creates the directory 0700 and the ledger 0600, because it is plaintext money", async () => {
		const home = tempHome()
		expect((await capture(["init", "--json"], { TRAJ_HOME: home })).code).toBe(0)
		expect(fileMode(home)).toBe(0o700)
		expect(fileMode(join(home, "traj.db"))).toBe(0o600)
	})

	it("keeps the -wal and -shm a command leaves beside the ledger private too", async () => {
		const home = tempHome()
		await capture(["init"], { TRAJ_HOME: home })
		const store = mustOpen(home)
		for (const file of ["traj.db", "traj.db-wal", "traj.db-shm"]) {
			expect(fileMode(join(home, file))).toBe(0o600)
		}
		store.close()
	})

	it("creates the only empty ledger, so a read names the path instead", async () => {
		const home = tempHome()
		const res = await capture(["balance", "--as-of", "2026-01-01", "--json"], {
			TRAJ_HOME: home,
		})
		expect(res.code).toBe(4)
		expect(JSON.parse(res.err).error).toEqual({
			code: "ledger_missing",
			exitCode: 4,
			message: `No ledger at ${join(home, "traj.db")}.`,
			hint: 'Run "traj init" to create one.',
		})
		expect(existsSync(home)).toBe(false)
	})

	it("refuses a write, and an empty data directory, the same way", async () => {
		const missing = tempHome()
		const write = await capture(
			["account", "add", "Cash", "--type", "asset", "--currency", "THB", "--json"],
			{ TRAJ_HOME: missing },
		)
		expect(write.code).toBe(4)
		expect(JSON.parse(write.err).error.code).toBe("ledger_missing")
		expect(existsSync(missing)).toBe(false)

		const empty = mkdtempSync(join(tmpdir(), "traj-test-"))
		const read = await capture(["scenario", "list", "--json"], { TRAJ_HOME: empty })
		expect(JSON.parse(read.err).error.code).toBe("ledger_missing")
		expect(readdirSync(empty)).toEqual([])
		expect((await capture(["init"], { TRAJ_HOME: empty })).code).toBe(0)
		expect((await capture(["scenario", "list", "--json"], { TRAJ_HOME: empty })).code).toBe(0)
	})

	it("says in the schema and the help who creates a ledger", async () => {
		const listing = JSON.parse((await capture(["schema", "--json"])).out) as {
			commands: { name: string; summary: string }[]
		}
		const init = listing.commands.find((command) => command.name === "init")
		expect(init?.summary).toBe("Create an empty ledger; only restore may also create one")
		expect((await capture(["help"])).out).toContain(
			"Create an empty ledger; only restore may also create one",
		)
		const detail = JSON.parse((await capture(["schema", "init", "--json"])).out)
		expect(detail.output.properties.directory.description).toContain("0700")
		expect(detail.output.properties.database.description).toContain("0600")
		expect(detail.output.properties.hint.description).toContain("first account")
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
