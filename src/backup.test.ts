import { describe, expect, it } from "bun:test"
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { backupPath } from "./backup/testing"
import { goldenHome, goldenJsonl } from "./interchange/testing"
import { tempHome } from "./store/testing"
import { capture, errorOf } from "./test-support"

const backup = async (home: string, out: string) =>
	capture(["backup", "--out", out, "--json"], { TRAJ_HOME: home })

describe("backup", () => {
	it("writes the one restorable file, byte-identical to the canonical export", async () => {
		const out = backupPath()
		const res = await backup(await goldenHome(), out)
		expect(res.code).toBe(0)
		expect(res.err).toBe("")
		const data = JSON.parse(res.out)
		expect(data).toEqual({
			directory: resolve(out),
			schemaVersion: 2,
			files: ["traj.jsonl"],
			rows: { entity: 1, account: 7, tx: 4, posting: 8, scenario: 3 },
		})
		expect(await Bun.file(join(out, "traj.jsonl")).text()).toBe(await goldenJsonl())
	})

	it("writes the same bytes as `export --format jsonl` of the same database", async () => {
		const home = await goldenHome()
		const backedUp = backupPath()
		const exported = backupPath()
		await backup(home, backedUp)
		await capture(["export", "--format", "jsonl", "--out", exported, "--json"], { TRAJ_HOME: home })
		const [a, b] = await Promise.all([
			Bun.file(join(backedUp, "traj.jsonl")).text(),
			Bun.file(join(exported, "traj.jsonl")).text(),
		])
		expect(b).toBe(a)
	})

	it("refuses an existing directory, so a typo cannot overwrite an older backup", async () => {
		const out = backupPath()
		mkdirSync(out)
		const res = await backup(await goldenHome(), out)
		expect(res.code).toBe(5)
		expect(errorOf(res).code).toBe("output_exists")
	})

	it("requires --out, naming the flag", async () => {
		const res = await capture(["backup", "--json"], { TRAJ_HOME: tempHome() })
		expect(res.code).toBe(2)
		expect(res.out).toBe("")
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "--out" })
	})

	it("describes the file it wrote in the human Format too", async () => {
		const out = backupPath()
		const res = await capture(["backup", "--out", out], { TRAJ_HOME: await goldenHome() })
		expect(res.code).toBe(0)
		expect(res.out).toContain("traj.jsonl")
		expect(res.out).toContain("schemaVersion: 2")
	})
})
