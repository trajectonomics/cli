import { describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { backupPath } from "./backup/testing"
import { goldenHome, goldenJsonl } from "./interchange/testing"
import { tempHome } from "./store/testing"
import { capture, errorOf } from "./test-support"

/** A backup of the golden home, taken through the command that a caller would use. */
async function goldenBackup(): Promise<string> {
	const out = backupPath()
	const res = await capture(["backup", "--out", out, "--json"], { TRAJ_HOME: await goldenHome() })
	expect(res.code).toBe(0)
	return out
}

describe("restore", () => {
	it("round-trips a backup into an empty data directory, byte for byte", async () => {
		const backup = await goldenBackup()
		const home = tempHome()
		const res = await capture(["restore", backup, "--json"], { TRAJ_HOME: home })
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toEqual({
			database: join(home, "traj.db"),
			file: join(backup, "traj.jsonl"),
			rows: { entity: 1, account: 7, tx: 4, posting: 8, scenario: 3 },
		})
		const exported = backupPath()
		await capture(["export", "--format", "jsonl", "--out", exported, "--json"], { TRAJ_HOME: home })
		expect(await Bun.file(join(exported, "traj.jsonl")).text()).toBe(await goldenJsonl())
	})

	it("reads the backup file itself, not only the directory around it", async () => {
		const backup = await goldenBackup()
		const res = await capture(["restore", join(backup, "traj.jsonl"), "--json"], {
			TRAJ_HOME: tempHome(),
		})
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out).file).toBe(join(backup, "traj.jsonl"))
	})

	it("refuses a database that already holds data, and changes nothing", async () => {
		const backup = await goldenBackup()
		const home = await goldenHome()
		const res = await capture(["restore", backup, "--json"], { TRAJ_HOME: home })
		expect(res.code).toBe(5)
		expect(errorOf(res)).toMatchObject({
			code: "restore_target_not_empty",
			hint: expect.stringContaining("TRAJ_HOME"),
		})
		const after = await capture(["inspect", "--json"], { TRAJ_HOME: home })
		expect(JSON.parse(after.out).tables.map((table: { count: number }) => table.count)).toEqual([
			1, 7, 4, 8, 3,
		])
	})

	it("reports a backup that is not there, and creates no data directory for it", async () => {
		const home = tempHome()
		const res = await capture(["restore", join(home, "nope"), "--json"], { TRAJ_HOME: home })
		expect(res.code).toBe(4)
		expect(errorOf(res)).toMatchObject({ code: "not_found", path: "source" })
		expect(existsSync(join(home, "traj.db"))).toBe(false)
	})

	it("refuses a directory of CSV exports: only the canonical JSONL restores", async () => {
		const out = backupPath()
		const home = await goldenHome()
		await capture(["export", "--format", "csv", "--out", out, "--json"], { TRAJ_HOME: home })
		const res = await capture(["restore", out, "--json"], { TRAJ_HOME: tempHome() })
		expect(res.code).toBe(4)
		expect(errorOf(res)).toMatchObject({ code: "not_found", path: "source" })
		expect(errorOf(res).message).toContain("traj.jsonl")
	})

	it("refuses a backup this build's schema version cannot read, at its header line", async () => {
		const backup = await goldenBackup()
		const file = Bun.file(join(backup, "traj.jsonl"))
		const text = await file.text()
		await Bun.write(file, text.replace('"schemaVersion":2', '"schemaVersion":99'))
		const res = await capture(["restore", backup, "--json"], { TRAJ_HOME: tempHome() })
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "line.1.schemaVersion" })
	})

	it("publishes the codes a caller has to handle", async () => {
		const res = await capture(["schema", "restore", "--json"])
		const codes = JSON.parse(res.out).errorCodes as string[]
		for (const code of [
			"backup_unreadable",
			"invalid_input",
			"not_found",
			"restore_target_not_empty",
		]) {
			expect(codes).toContain(code)
		}
	})

	it("describes what it wrote in the human Format too", async () => {
		const backup = await goldenBackup()
		const home = tempHome()
		const res = await capture(["restore", backup], { TRAJ_HOME: home })
		expect(res.code).toBe(0)
		expect(res.out).toContain(`database: ${join(home, "traj.db")}`)
		expect(res.out).toContain("tx: 4")
	})
})
