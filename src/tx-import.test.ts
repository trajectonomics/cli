import { describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import {
	cli,
	csv,
	errorOf,
	HEADER,
	imported,
	ledgerSize,
	row,
	seeded,
	tempHome,
} from "./tx-import-test-support"

describe("tx import --template", () => {
	it("prints the header byte for byte and creates no data directory", async () => {
		const home = tempHome()
		const res = await cli(home)(["tx", "import", "--template"])
		expect(res.code).toBe(0)
		expect(res.out).toBe(HEADER)
		expect(existsSync(home)).toBe(false)
	})

	it("returns the template as a JSON string", async () => {
		const res = await cli(tempHome())(["tx", "import", "--template", "--json"])
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toBe(HEADER)
	})

	it("rejects every ambiguous form as invalid input and opens nothing", async () => {
		const home = tempHome()
		const traj = cli(home)
		const withFile = await traj(["tx", "import", "rows.csv", "--template", "--json"])
		expect(withFile.code).toBe(2)
		expect(errorOf(withFile)).toMatchObject({ code: "invalid_input", path: "file" })
		const withDryRun = await traj(["tx", "import", "--template", "--dry-run", "--json"])
		expect(withDryRun.code).toBe(2)
		expect(errorOf(withDryRun)).toMatchObject({ code: "invalid_input", path: "dryRun" })
		const neither = await traj(["tx", "import", "--json"])
		expect(neither.code).toBe(2)
		expect(errorOf(neither)).toMatchObject({ code: "invalid_input", path: "file" })
		expect(existsSync(home)).toBe(false)
	})
})

describe("tx import FILE.csv", () => {
	it("adds one two-posting transaction per row, in file order, and counts them", async () => {
		const home = tempHome()
		const traj = cli(home)
		const opened = await seeded(traj)
		const file = csv(home, "rows.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "120.50", "Lunch", "kbank:1", "side"]),
			row(["2026-03-02", "Salary", "Cash", "5000", "เงินเดือน", "kbank:2", ""]),
		])
		const res = await traj(["tx", "import", file, "--json"])
		expect(res.code).toBe(0)
		const data = imported(res)
		expect(data.counts).toEqual({ added: 2, duplicate: 0, rejected: 0 })
		expect(data.rows.map((entry) => [entry.line, entry.status])).toEqual([
			[2, "added"],
			[3, "added"],
		])
		const [lunch, salary] = data.rows
		expect(lunch?.transaction).toMatchObject({
			date: "2026-03-01",
			memo: "Lunch",
			externalRef: "kbank:1",
			linkedTo: null,
			version: 1,
		})
		expect(lunch?.transaction.postings).toMatchObject([
			{
				ordinal: 0,
				accountId: opened["Food"]?.id,
				amount: "120.50",
				dimensions: { project: "side" },
			},
			{
				ordinal: 1,
				accountId: opened["Cash"]?.id,
				amount: "-120.50",
				dimensions: { project: "side" },
			},
		])
		expect(salary?.transaction.memo).toBe("เงินเดือน")
		expect(salary?.transaction.postings[1]?.dimensions).toBeNull()
		expect(await ledgerSize(traj)).toEqual({ transactions: 2, postings: 4 })
	})

	it("resolves an account by id as well as by name, and keeps a memo's commas and quotes", async () => {
		const home = tempHome()
		const traj = cli(home)
		const opened = await seeded(traj)
		const byId = opened["Cash"]?.id ?? ""
		const file = csv(home, "quoted.csv", [
			HEADER,
			`2026-03-01,${byId},"Food",1,"memo ""with"" a, comma",ref:1,`,
		])
		const res = await traj(["tx", "import", file, "--json"])
		expect(res.code).toBe(0)
		expect(imported(res).rows[0]?.transaction).toMatchObject({
			memo: 'memo "with" a, comma',
			postings: [
				{ accountId: opened["Food"]?.id, amount: "1.00" },
				{ accountId: byId, amount: "-1.00" },
			],
		})
	})

	it("keeps a quoted empty cell absent and a quoted space present", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const file = csv(home, "quoted-empty.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "1", '""', "q1", '" "']),
			row(["2026-03-02", "Cash", "Food", "1", '" "', "q2", ""]),
		])
		const data = imported(await traj(["tx", "import", file, "--json"]))
		expect(data.rows[0]?.transaction.memo).toBeNull()
		expect(data.rows[0]?.transaction.postings[0]?.dimensions).toEqual({ project: " " })
		expect(data.rows[1]?.transaction.memo).toBe(" ")
		expect(data.rows[1]?.transaction.postings[0]?.dimensions).toBeNull()
	})

	it("imports a header-only file as a no-op", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const res = await traj(["tx", "import", csv(home, "empty.csv", [HEADER]), "--json"])
		expect(res.code).toBe(0)
		expect(imported(res)).toEqual({
			dryRun: false,
			file: join(dirname(home), "empty.csv"),
			rows: [],
			counts: { added: 0, duplicate: 0, rejected: 0 },
		})
		expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
	})

	it("adds nothing when the same file is imported twice", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const file = csv(home, "twice.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "10", "", "dup:1", ""]),
			row(["2026-03-02", "Cash", "Food", "20", "", "dup:2", ""]),
		])
		const first = imported(await traj(["tx", "import", file, "--json"]))
		const before = await ledgerSize(traj)
		const again = await traj(["tx", "import", file, "--json"])
		expect(again.code).toBe(0)
		const second = imported(again)
		expect(second.counts).toEqual({ added: 0, duplicate: 2, rejected: 0 })
		expect(second.rows.map((entry) => entry.status)).toEqual(["duplicate", "duplicate"])
		expect(second.rows.map((entry) => entry.transaction.id)).toEqual(
			first.rows.map((entry) => entry.transaction.id),
		)
		expect(await ledgerSize(traj)).toEqual(before)
	})

	it("keeps a re-import of a voided row a duplicate and does not re-add it", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const file = csv(home, "voided.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "10", "", "gone:1", ""]),
		])
		const added = imported(await traj(["tx", "import", file, "--json"])).rows[0]?.transaction
		if (added?.id === null || added?.id === undefined) throw new Error("no transaction id")
		const voided = await traj(["tx", "void", added.id, "--date", "2026-03-02", "--json"])
		expect(voided.code).toBe(0)
		const before = await ledgerSize(traj)
		const again = imported(await traj(["tx", "import", file, "--json"]))
		expect(again.rows[0]?.status).toBe("duplicate")
		expect(again.rows[0]?.transaction.id).toBe(added.id)
		expect(await ledgerSize(traj)).toEqual(before)
	})

	it("writes nothing under --dry-run and nulls every id it minted", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const file = csv(home, "dry.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "10", "", "dry:1", ""]),
			row(["2026-03-01", "Cash", "Food", "10", "", "dry:1", ""]),
		])
		const dry = imported(await traj(["tx", "import", file, "--dry-run", "--json"]))
		expect(dry.dryRun).toBe(true)
		expect(dry.rows.map((entry) => entry.status)).toEqual(["added", "duplicate"])
		expect(dry.rows.map((entry) => entry.transaction.id)).toEqual([null, null])
		expect(dry.counts).toEqual({ added: 1, duplicate: 1, rejected: 0 })
		expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })

		const real = imported(await traj(["tx", "import", file, "--json"]))
		expect(real.rows.map((entry) => entry.status)).toEqual(["added", "duplicate"])
		expect(real.rows[0]?.transaction.id).not.toBeNull()
		expect(await ledgerSize(traj)).toEqual({ transactions: 1, postings: 2 })

		// A duplicate of a stored row keeps the id it will find again; only minted ids are null.
		const repeat = imported(await traj(["tx", "import", file, "--dry-run", "--json"]))
		expect(repeat.rows[0]?.transaction.id).toBe(real.rows[0]?.transaction.id)
		expect(repeat.rows[1]?.transaction.id).toBe(real.rows[0]?.transaction.id)
	})
})
