import { describe, expect, it } from "bun:test"
import { join } from "node:path"
import { goldenStore } from "../interchange/testing"
import { must, mustOpen, tempHome } from "./testing"

const WRITER = join(import.meta.dir, "concurrent-writer.fixture.ts")

// The rows `interchange/fixtures/golden.sql` writes, read from the fixture, not from the store.
const ENTITY = ["00000000-0000-7000-8000-000000000001"]
const ACCOUNT = [
	"0194a000-0001-7000-8000-000000000001",
	"0194a000-0002-7000-8000-000000000002",
	"0194a000-0003-7000-8000-000000000003",
	"0194a000-0004-7000-8000-000000000004",
	"0194a000-0005-7000-8000-000000000005",
	"0194a000-0006-7000-8000-000000000006",
	"0194a000-0009-7000-8000-000000000009",
]
const TX = [
	"0194b000-0001-7000-8000-000000000001",
	"0194b000-0002-7000-8000-000000000002",
	"0194b000-0003-7000-8000-000000000003",
	"0194b000-0004-7000-8000-000000000004",
]
const POSTING = TX.flatMap((txId) => [`${txId}#0`, `${txId}#1`])
const SCENARIO = [
	"0194c000-0001-7000-8000-000000000001",
	"0194c000-0002-7000-8000-000000000002",
	"0194c000-0003-7000-8000-000000000003",
]

describe("dump", () => {
	it("reads every row of every table, tombstones included, in the canonical order", async () => {
		const store = await goldenStore()
		const dump = must(store.dump())
		expect(dump.entity.map((row) => row.id)).toEqual(ENTITY)
		expect(dump.account.map((row) => row.id)).toEqual(ACCOUNT)
		expect(dump.tx.map((row) => row.id)).toEqual(TX)
		expect(dump.posting.map((row) => `${row.txId}#${row.ordinal}`)).toEqual(POSTING)
		expect(dump.scenario.map((row) => row.id)).toEqual(SCENARIO)
		// The fixture holds a tombstoned account and a tombstoned scenario, and both are dumped.
		expect(dump.account.filter((row) => row.deletedAt !== null)).toHaveLength(1)
		expect(dump.scenario.filter((row) => row.deletedAt !== null)).toHaveLength(1)
		// Money stays the store's minor units; the row view is a later layer's job.
		expect(dump.posting.map((row) => row.amount)).toEqual([
			9007199254740991, -9007199254740991, 5000000, -5000000, -12550, 12550, 12550, -12550,
		])
	})

	it("dumps the seeded entity and no rows on a fresh database", () => {
		const store = mustOpen(tempHome())
		expect(must(store.dump())).toEqual({
			entity: [
				{
					id: "00000000-0000-7000-8000-000000000001",
					name: "Personal",
					version: 1,
					createdAt: "1970-01-01T00:00:00.000Z",
					updatedAt: "1970-01-01T00:00:00.000Z",
					deletedAt: null,
				},
			],
			account: [],
			tx: [],
			posting: [],
			scenario: [],
		})
	})

	it("cannot see a posting whose transaction is missing while another process writes", async () => {
		const home = tempHome()
		const setup = mustOpen(home)
		must(setup.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
		must(setup.createAccount({ name: "Food", type: "expense", currency: "THB" }))
		setup.close()

		const store = mustOpen(home)
		const writer = Bun.spawn([process.execPath, WRITER, home, "0", "2000"], {
			stdout: "pipe",
			stderr: "pipe",
		})
		let dumps = 0
		let orphan: string | null = null
		while (writer.exitCode === null) {
			const dump = must(store.dump())
			dumps += 1
			const known = new Set(dump.tx.map((row) => row.id))
			const missing = dump.posting.find((row) => !known.has(row.txId))
			if (missing) orphan = `${missing.txId}#${missing.ordinal}`
			await Bun.sleep(0)
		}
		const [code, err] = await Promise.all([writer.exited, new Response(writer.stderr).text()])
		expect({ code, err }).toEqual({ code: 0, err: "" })
		expect(orphan).toBeNull()
		expect(dumps).toBeGreaterThan(10)
		store.close()
	}, 30_000)

	it("counts every table's rows, tombstones included, in one statement", async () => {
		const store = await goldenStore()
		expect(must(store.counts())).toEqual({
			entity: ENTITY.length,
			account: ACCOUNT.length,
			tx: TX.length,
			posting: POSTING.length,
			scenario: SCENARIO.length,
		})
	})

	it("counts exactly the rows the dump returns", async () => {
		const store = await goldenStore()
		const dump = must(store.dump())
		const counts = must(store.counts())
		for (const table of ["entity", "account", "tx", "posting", "scenario"] as const) {
			expect(counts[table]).toBe(dump[table].length)
		}
	})
})
