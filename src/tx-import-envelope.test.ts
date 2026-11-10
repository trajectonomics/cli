import { describe, expect, it } from "bun:test"
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
import { account } from "./tx-test-support"

describe("tx import rejections", () => {
	it("writes nothing when one row is rejected, and picks the highest Exit class", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const file = csv(home, "mixed.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "10", "", "ok", ""]),
			row(["2026-03-02", "Cash", "Food", "", "", "bad", ""]),
			row(["2026-03-03", "Nope", "Food", "1", "", "worse", ""]),
		])
		const res = await traj(["tx", "import", file, "--json"])
		expect(res.code).toBe(3)
		const error = errorOf(res)
		expect(error).toMatchObject({
			code: "UNKNOWN_ACCOUNT",
			exitCode: 3,
			path: "line.4.from",
			message: "The import was rejected and nothing was written.",
			hint: "Fix line 3 first: line.3.amount: the amount cell is required",
		})
		expect(error.details.rows.map((entry) => [entry.line, entry.reason.code])).toEqual([
			[3, "invalid_input"],
			[4, "UNKNOWN_ACCOUNT"],
		])
		expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
	})

	it("breaks an Exit-class tie on the earliest line", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const seed = await traj([
			"tx",
			"add",
			"--from",
			"Cash",
			"--to",
			"Food",
			"--amount",
			"1",
			"--date",
			"2026-03-01",
			"--external-ref",
			"one",
			"--json",
		])
		expect(seed.code).toBe(0)
		await traj([
			"tx",
			"add",
			"--from",
			"Cash",
			"--to",
			"Food",
			"--amount",
			"1",
			"--date",
			"2026-03-01",
			"--external-ref",
			"two",
			"--json",
		])
		const file = csv(home, "ties.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "2", "", "one", ""]),
			row(["2026-03-01", "Cash", "Food", "2", "", "two", ""]),
		])
		const res = await traj(["tx", "import", file, "--json"])
		expect(res.code).toBe(5)
		const error = errorOf(res)
		expect(error.code).toBe("external_ref_conflict")
		expect(error.path).toBe("line.2.external_ref")
		expect(error.details.rows.map((entry) => entry.reason.code)).toEqual([
			"external_ref_conflict",
			"external_ref_conflict",
		])
		expect(await ledgerSize(traj)).toEqual({ transactions: 2, postings: 4 })
	})

	it("reports a store-level rejection even when another row fails to build", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		await account(traj, "Old", "expense")
		await traj(["account", "close", "Old"])
		const file = csv(home, "store.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "", "", "build", ""]),
			row(["2026-03-02", "Cash", "Old", "1", "", "store", ""]),
		])
		const res = await traj(["tx", "import", file, "--json"])
		expect(res.code).toBe(3)
		const error = errorOf(res)
		expect(error.code).toBe("account_archived")
		expect(error.details.rows.map((entry) => [entry.line, entry.reason.code])).toEqual([
			[2, "invalid_input"],
			[3, "account_archived"],
		])
		expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
	})

	it("rejects a repeated reference when the earlier row was itself rejected", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const file = csv(home, "repeat.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "", "", "same", ""]),
			row(["2026-03-02", "Cash", "Food", "1", "", "same", ""]),
		])
		const res = await traj(["tx", "import", file, "--json"])
		expect(res.code).toBe(5)
		const error = errorOf(res)
		expect(error.details.rows.map((entry) => [entry.line, entry.reason.code])).toEqual([
			[2, "invalid_input"],
			[3, "external_ref_conflict"],
		])
		expect(error.details.rows[1]?.reason.path).toBe("line.3.external_ref")
		expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
	})

	it("reports the same-file duplicate as a duplicate, not a rejection", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const file = csv(home, "same.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "1", "", "x", ""]),
			row(["2026-03-01", "Cash", "Food", "1", "", "x", ""]),
		])
		const data = imported(await traj(["tx", "import", file, "--json"]))
		expect(data.rows.map((entry) => entry.status)).toEqual(["added", "duplicate"])
		expect(data.rows[1]?.transaction.id).toBe(data.rows[0]?.transaction.id)
		expect(await ledgerSize(traj)).toEqual({ transactions: 1, postings: 2 })
	})
})
