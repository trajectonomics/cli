import { describe, expect, it, setSystemTime } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { goldenHome, goldenJsonl } from "../interchange/testing"
import { tempHome } from "../store/testing"
import { capture } from "../test-support"

/** A directory path that does not exist yet, so the command is the one that creates it. */
const outPath = () => join(mkdtempSync(join(tmpdir(), "traj-export-")), "out")

const SEEDED =
	'{"record":"entity","id":"00000000-0000-7000-8000-000000000001","name":"Personal","version":1,' +
	'"createdAt":"1970-01-01T00:00:00.000Z","updatedAt":"1970-01-01T00:00:00.000Z","deletedAt":null}'

describe("export --format jsonl", () => {
	it("writes traj.jsonl byte-identical to the canonical export", async () => {
		const out = outPath()
		const res = await capture(["export", "--out", out, "--json"], { TRAJ_HOME: await goldenHome() })
		expect(res.code).toBe(0)
		expect(res.err).toBe("")
		const data = JSON.parse(res.out)
		expect(data.format).toBe("jsonl")
		expect(data.files).toEqual(["traj.jsonl"])
		expect(data.schemaVersion).toBe(2)
		expect(data.directory).toBe(resolve(out))
		expect(data.rows).toEqual({ entity: 1, account: 7, tx: 4, posting: 8, scenario: 3 })
		expect(await Bun.file(join(out, "traj.jsonl")).text()).toBe(await goldenJsonl())
	})

	it("describes what it wrote when --json is not given, and changes no file format", async () => {
		const out = outPath()
		const res = await capture(["export", "--out", out], { TRAJ_HOME: await goldenHome() })
		expect(res.code).toBe(0)
		expect(res.out).toContain("jsonl")
		expect(res.out).toContain("traj.jsonl")
		expect(await Bun.file(join(out, "traj.jsonl")).text()).toBe(await goldenJsonl())
	})

	it("exports a fresh database as the header and the seeded entity", async () => {
		const out = outPath()
		const res = await capture(["export", "--out", out, "--json"], { TRAJ_HOME: tempHome() })
		expect(res.code).toBe(0)
		expect(await Bun.file(join(out, "traj.jsonl")).text()).toBe(
			`{"record":"header","formatVersion":1,"schemaVersion":2}\n${SEEDED}\n`,
		)
		expect(JSON.parse(res.out).rows).toEqual({
			entity: 1,
			account: 0,
			tx: 0,
			posting: 0,
			scenario: 0,
		})
	})

	it("gives byte-identical files for two exports of the same database", async () => {
		const first = outPath()
		setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
		const one = await capture(["export", "--out", first, "--json"], {
			TRAJ_HOME: await goldenHome(),
		})
		const second = outPath()
		setSystemTime(new Date("2031-06-30T23:59:59.999Z"))
		const two = await capture(["export", "--out", second, "--json"], {
			TRAJ_HOME: await goldenHome(),
		})
		setSystemTime()
		expect(one.code).toBe(0)
		expect(two.code).toBe(0)
		const [a, b] = await Promise.all([
			Bun.file(join(first, "traj.jsonl")).text(),
			Bun.file(join(second, "traj.jsonl")).text(),
		])
		expect(b).toBe(a)
		expect(JSON.parse(two.out).rows).toEqual(JSON.parse(one.out).rows)
		expect(JSON.parse(two.out).schemaVersion).toBe(JSON.parse(one.out).schemaVersion)
	})
})

describe("export's refusals", () => {
	it("requires --out, naming the flag", async () => {
		const res = await capture(["export", "--json"], { TRAJ_HOME: tempHome() })
		expect(res.code).toBe(2)
		expect(res.out).toBe("")
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "invalid_input",
			path: "out",
		})
	})

	it("refuses an output path that already exists and writes nothing", async () => {
		const out = outPath()
		mkdirSync(out)
		const res = await capture(["export", "--out", out, "--json"], { TRAJ_HOME: await goldenHome() })
		expect(res.code).toBe(5)
		expect(res.out).toBe("")
		const { error } = JSON.parse(res.err)
		expect(error.code).toBe("output_exists")
		expect(error.path).toBe("out")
		expect(error.details.path).toBe(resolve(out))
		expect(existsSync(join(out, "traj.jsonl"))).toBe(false)
	})

	it("names the path and a stable code when the write cannot happen", async () => {
		const file = join(mkdtempSync(join(tmpdir(), "traj-export-")), "afile")
		writeFileSync(file, "")
		const out = join(file, "out")
		const res = await capture(["export", "--out", out, "--json"], { TRAJ_HOME: await goldenHome() })
		expect(res.code).toBe(1)
		expect(res.out).toBe("")
		const { error } = JSON.parse(res.err)
		expect(error.code).toBe("export_failed")
		expect(error.path).toBe("out")
		expect(error.details.path).toBe(resolve(out))
		expect(error.message).toContain(resolve(out))
		// The directory this run tried to create is gone again; the file is untouched.
		expect(existsSync(out)).toBe(false)
		expect(existsSync(file)).toBe(true)
	})

	it("refuses a --format it does not know", async () => {
		const res = await capture(["export", "--out", outPath(), "--format", "xlsx", "--json"], {
			TRAJ_HOME: tempHome(),
		})
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "invalid_input",
			path: "format",
		})
	})
})

describe("export's description", () => {
	it("publishes the leaf, its format and its two new error codes", async () => {
		const res = await capture(["schema", "export", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.name).toBe("export")
		expect(data.positionals).toEqual([])
		expect(data.input.properties.out.type).toBe("string")
		expect(data.output.properties.directory.type).toBe("string")
		for (const code of [
			"output_exists",
			"export_failed",
			"database_busy",
			"database_too_new",
			"migration_failed",
		]) {
			expect(data.errorCodes).toContain(code)
		}
		expect(JSON.stringify(data.examples)).toContain("traj export")
	})
})

describe("export's determinism", () => {
	it("writes the same bytes under another timezone and locale", async () => {
		const first = outPath()
		const one = await capture(["export", "--out", first, "--json"], {
			TRAJ_HOME: await goldenHome(),
		})
		const env = { TZ: "Pacific/Kiritimati", LC_ALL: "th_TH.UTF-8", LANG: "th_TH.UTF-8" }
		const saved = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]))
		try {
			Object.assign(process.env, env)
			const second = outPath()
			const two = await capture(["export", "--format", "csv", "--out", second, "--json"], {
				TRAJ_HOME: await goldenHome(),
				...env,
			})
			expect(two.code).toBe(0)
			expect(JSON.parse(two.out).rows).toEqual(JSON.parse(one.out).rows)
			const [a, csv] = await Promise.all([
				Bun.file(join(first, "traj.jsonl")).text(),
				Bun.file(join(second, "entity.csv")).bytes(),
			])
			expect(a).toBe(await goldenJsonl())
			// Bun's text decoder strips a leading BOM, so read the bytes to see it.
			expect([...csv.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
		} finally {
			for (const [key, value] of Object.entries(saved)) {
				if (value === undefined) delete process.env[key]
				else process.env[key] = value
			}
		}
	})
})
