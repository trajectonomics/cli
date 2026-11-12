import { describe, expect, it, setSystemTime } from "bun:test"
import { goldenHome } from "../interchange/testing"
import { capture } from "../test-support"

const fixture = (name: string) => Bun.file(new URL(`fixtures/${name}`, import.meta.url)).text()

/** `capture` keeps the renderer's own text, so one newline is what stdout would add. */
const stdout = (text: string) => `${text}\n`

describe("inspect --all", () => {
	it("prints the golden fixture as the committed snapshot, byte for byte", async () => {
		const res = await capture(["inspect", "--all"], { TRAJ_HOME: await goldenHome() })
		expect(res.code).toBe(0)
		expect(res.err).toBe("")
		expect(stdout(res.out)).toBe(await fixture("inspect-all.txt"))
	})

	it("gives the same bytes on a second run and under a different wall clock", async () => {
		const res = await capture(["inspect", "--all"], { TRAJ_HOME: await goldenHome() })
		setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
		const first = await capture(["inspect", "--all"], { TRAJ_HOME: await goldenHome() })
		setSystemTime(new Date("2031-06-30T23:59:59.999Z"))
		const second = await capture(["inspect", "--all"], { TRAJ_HOME: await goldenHome() })
		setSystemTime()
		expect(first).toEqual(res)
		expect(second).toEqual(res)
	})

	it("keeps Thai text and every table's heading with its row count", async () => {
		const res = await capture(["inspect", "--all"], { TRAJ_HOME: await goldenHome() })
		expect(res.out).toContain("ธนาคารกสิกร")
		expect(res.out).toContain("ร้านกาแฟ")
		for (const heading of [
			"entity (1 row)",
			"account (7 rows)",
			"tx (4 rows)",
			"posting (8 rows)",
			"scenario (3 rows)",
		]) {
			expect(res.out).toContain(heading)
		}
	})
})

describe("inspect <table>", () => {
	it("shows every column of one table, tombstones included", async () => {
		const res = await capture(["inspect", "account"], { TRAJ_HOME: await goldenHome() })
		expect(res.code).toBe(0)
		expect(res.out).toContain("account (7 rows)")
		// The tombstoned account and the archived one are both in the raw view.
		expect(res.out).toContain("Typo account")
		expect(res.out).toContain("Old wallet")
		expect(res.out).toContain("2026-01-02T10:00:00.500Z")
		// Every column is headed, entityId and the sync columns included.
		for (const column of ["entityId", "archivedAt", "version", "deletedAt"]) {
			expect(res.out).toContain(column)
		}
		expect(res.out).not.toContain("scenario (")
	})

	it("returns the same rows as JSON, with money as decimal strings", async () => {
		const res = await capture(["inspect", "posting", "--json"], {
			TRAJ_HOME: await goldenHome(),
		})
		expect(res.code).toBe(0)
		const [posting] = JSON.parse(res.out).tables
		expect(posting.name).toBe("posting")
		expect(posting.count).toBe(8)
		expect(posting.rows).toHaveLength(8)
		expect(posting.rows[0]).toEqual({
			txId: "0194b000-0001-7000-8000-000000000001",
			ordinal: 0,
			accountId: "0194a000-0001-7000-8000-000000000001",
			amount: "90071992547409.91",
			currency: "THB",
			dimensions: null,
		})
		expect(posting.rows[2].dimensions).toEqual({
			channel: "transfer",
			project: "ร้านกาแฟ",
		})
	})

	it("keeps a Scenario document as its stored canonical text", async () => {
		const res = await capture(["inspect", "scenario", "--json"], {
			TRAJ_HOME: await goldenHome(),
		})
		const [scenario] = JSON.parse(res.out).tables
		expect(scenario.count).toBe(3)
		expect(scenario.rows[0].document).toBe(
			'{"accounts":[{"id":"savings","kind":"asset","rate":275},{"id":"mortgage","kind":"liability","rate":500}],"cashflow":{"surplus":[{"account":"savings"}],"withdraw":["savings"]},"currency":"THB","economy":{"inflation":300},"flows":[{"amount":5500000,"earned":true,"frequency":"monthly","growth":"inflation","id":"salary","kind":"income","start":"2026-01-01"}],"schemaVersion":1}',
		)
		expect(scenario.rows[0].contentHash).toStartWith("jcs1:sha256:")
	})

	it("refuses a table that is not one of the five, naming the valid ones", async () => {
		const res = await capture(["inspect", "accounts", "--json"], {
			TRAJ_HOME: await goldenHome(),
		})
		expect(res.code).toBe(2)
		expect(res.out).toBe("")
		const { error } = JSON.parse(res.err)
		expect(error.code).toBe("invalid_input")
		expect(error.path).toBe("table")
		expect(error.message).toContain('Did you mean "account"?')
		expect(error.hint).toContain("entity, account, tx, posting, scenario")

		const unknown = await capture(["inspect", "nope"], { TRAJ_HOME: await goldenHome() })
		expect(unknown.code).toBe(2)
		expect(unknown.err).toContain("Unknown table: nope")
		expect(unknown.err).toContain("entity, account, tx, posting, scenario")
	})

	it("refuses --all together with a table name, so it never guesses", async () => {
		const res = await capture(["inspect", "tx", "--all", "--json"], {
			TRAJ_HOME: await goldenHome(),
		})
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "invalid_input",
			path: "all",
		})
	})
})

describe("inspect's determinism", () => {
	it("gives the same bytes under another timezone and locale", async () => {
		const home = await goldenHome()
		const before = await capture(["inspect", "--all"], { TRAJ_HOME: home })
		const env = { TZ: "Pacific/Kiritimati", LC_ALL: "th_TH.UTF-8", LANG: "th_TH.UTF-8" }
		const saved = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]))
		try {
			Object.assign(process.env, env)
			const after = await capture(["inspect", "--all"], { TRAJ_HOME: home, ...env })
			expect(after).toEqual(before)
		} finally {
			for (const [key, value] of Object.entries(saved)) {
				if (value === undefined) delete process.env[key]
				else process.env[key] = value
			}
		}
	})
})
