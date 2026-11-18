import { describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { backupPath } from "./backup/testing"
import { goldenHome } from "./interchange/testing"
import { tempHome } from "./store/testing"
import { capture, errorOf } from "./test-support"

/** A backup of `home`, taken the way a caller takes one before removing anything. */
async function backupOf(home: string): Promise<string> {
	const out = backupPath()
	const res = await capture(["backup", "--out", out, "--json"], { TRAJ_HOME: home })
	expect(res.code).toBe(0)
	return out
}

const remove = (home: string, ...flags: string[]) =>
	capture(["data", "remove", ...flags, "--json"], { TRAJ_HOME: home })

describe("data remove", () => {
	it("refuses without --confirm, and says in plain words what it would lose", async () => {
		const home = await goldenHome()
		const res = await remove(home)
		expect(res.code).toBe(2)
		const error = errorOf(res)
		expect(error).toMatchObject({ code: "invalid_input", path: "--confirm" })
		// The dispatcher names the flag beside the sentence, so the message leads with the loss (ADR-0013).
		expect(error.message).toBe(
			`4 transactions, 8 postings, 7 accounts and 3 scenarios in ${home} would be lost; type that path with --confirm to delete the data`,
		)
		expect(error.hint).toContain(`--confirm ${home}`)
		expect(existsSync(join(home, "traj.db"))).toBe(true)
	})

	it("treats a --confirm naming somewhere else as a refusal, quoting what was typed", async () => {
		const home = await goldenHome()
		const res = await remove(home, "--confirm", "/somewhere/else")
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({
			code: "invalid_input",
			path: "--confirm",
			message: `"/somewhere/else" is not ${home}; 4 transactions, 8 postings, 7 accounts and 3 scenarios in ${home} would be lost`,
		})
		expect(existsSync(join(home, "traj.db"))).toBe(true)
	})

	it("refuses a confirmed removal that names no backup", async () => {
		const home = await goldenHome()
		const res = await remove(home, "--confirm", home)
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({
			code: "invalid_input",
			path: "--backup",
			hint: expect.stringContaining("traj backup"),
		})
		expect(existsSync(join(home, "traj.db"))).toBe(true)
	})

	it("refuses a backup taken before the last write, and keeps the data", async () => {
		const home = await goldenHome()
		const backup = await backupOf(home)
		await capture(["account", "add", "Spare", "--type", "asset", "--currency", "THB", "--json"], {
			TRAJ_HOME: home,
		})
		const res = await remove(home, "--confirm", home, "--backup", backup)
		expect(res.code).toBe(3)
		expect(errorOf(res)).toMatchObject({
			code: "backup_stale",
			path: "backup",
			details: { file: join(backup, "traj.jsonl") },
		})
		expect(existsSync(join(home, "traj.db"))).toBe(true)
	})

	it("removes the database once a matching backup exists, and never the cache beside it", async () => {
		const home = await goldenHome()
		mkdirSync(join(home, "bin"), { recursive: true })
		writeFileSync(join(home, "bin", "traj"), "the launcher's cache")
		const backup = await backupOf(home)
		const res = await remove(home, "--confirm", home, "--backup", backup)
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toEqual({
			directory: home,
			database: join(home, "traj.db"),
			backup: join(backup, "traj.jsonl"),
			removed: [join(home, "traj.db")],
			kept: ["bin"],
			rows: { entity: 1, account: 7, tx: 4, posting: 8, scenario: 3 },
		})
		expect(existsSync(join(home, "traj.db"))).toBe(false)
		expect(await Bun.file(join(home, "bin", "traj")).text()).toBe("the launcher's cache")
	})

	it("leaves the backup restorable, which is what the guard was for", async () => {
		const home = await goldenHome()
		const backup = await backupOf(home)
		await remove(home, "--confirm", home, "--backup", backup)
		const restored = await capture(["restore", backup, "--json"], { TRAJ_HOME: home })
		expect(restored.code).toBe(0)
		const doctor = await capture(["doctor", "--json"], { TRAJ_HOME: home })
		expect(JSON.parse(doctor.out).ok).toBe(true)
	})

	it("reports a data directory with nothing to remove, and creates nothing", async () => {
		const home = tempHome()
		const res = await remove(home, "--confirm", home, "--backup", backupPath())
		expect(res.code).toBe(4)
		expect(errorOf(res).code).toBe("not_found")
		expect(existsSync(home)).toBe(false)
	})

	it("reports a backup path that holds no traj.jsonl", async () => {
		const home = await goldenHome()
		const res = await remove(home, "--confirm", home, "--backup", backupPath())
		expect(res.code).toBe(4)
		expect(errorOf(res)).toMatchObject({ code: "not_found", path: "backup" })
		expect(existsSync(join(home, "traj.db"))).toBe(true)
	})
})
