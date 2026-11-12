import { describe, expect, it } from "bun:test"
import { goldenHome } from "../interchange/testing"
import { tempHome } from "../store/testing"
import { capture } from "../test-support"

describe("the bare summary", () => {
	it("lists every table and its row count from the golden fixture", async () => {
		const res = await capture(["inspect", "--json"], { TRAJ_HOME: await goldenHome() })
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toEqual({
			tables: [
				{ name: "entity", count: 1 },
				{ name: "account", count: 7 },
				{ name: "tx", count: 4 },
				{ name: "posting", count: 8 },
				{ name: "scenario", count: 3 },
			],
		})
	})

	it("renders as a readable list of names and counts", async () => {
		const res = await capture(["inspect"], { TRAJ_HOME: await goldenHome() })
		expect(res.code).toBe(0)
		expect(res.out).toContain("account")
		expect(res.out).toContain("7")
		expect(res.out).not.toContain("createdAt")
	})

	it("shows the seeded Entity and empty tables on a fresh data directory", async () => {
		const res = await capture(["inspect", "--json"], { TRAJ_HOME: tempHome() })
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out).tables).toEqual([
			{ name: "entity", count: 1 },
			{ name: "account", count: 0 },
			{ name: "tx", count: 0 },
			{ name: "posting", count: 0 },
			{ name: "scenario", count: 0 },
		])

		const detail = await capture(["inspect", "--all", "--json"], { TRAJ_HOME: tempHome() })
		expect(detail.code).toBe(0)
		const tables = JSON.parse(detail.out).tables
		expect(tables[0].rows.map((row: { name: string }) => row.name)).toEqual(["Personal"])
		expect(tables.slice(1).map((table: { rows: unknown[] }) => table.rows)).toEqual([
			[],
			[],
			[],
			[],
		])

		const human = await capture(["inspect", "--all"], { TRAJ_HOME: tempHome() })
		expect(human.code).toBe(0)
		expect(human.out).toContain("entity (1 row)")
		expect(human.out).toContain("account (0 rows)")
	})
})
