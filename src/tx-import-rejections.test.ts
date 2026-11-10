import { describe, expect, it } from "bun:test"
import {
	cli,
	csv,
	errorOf,
	HEADER,
	ledgerSize,
	row,
	seeded,
	tempHome,
} from "./tx-import-test-support"
import { account } from "./tx-test-support"

describe("tx import rejections", () => {
	it("rejects a blank required cell at its column and names it in the hint", async () => {
		const columns = ["date", "from", "to", "amount", "external_ref"] as const
		for (const column of columns) {
			const home = tempHome()
			const traj = cli(home)
			await seeded(traj)
			const cells: Record<string, string> = {
				date: "2026-03-01",
				from: "Cash",
				to: "Food",
				amount: "1",
				memo: "",
				external_ref: "ref",
				project: "",
			}
			cells[column] = ""
			const res = await traj([
				"tx",
				"import",
				csv(home, "blank.csv", [HEADER, row(Object.values(cells))]),
				"--json",
			])
			expect(res.code).toBe(2)
			const error = errorOf(res)
			expect(error).toMatchObject({
				code: "invalid_input",
				exitCode: 2,
				path: `line.2.${column}`,
				hint: `Fix line 2 first: line.2.${column}: the ${column} cell is required`,
			})
			expect(error.details.rows[0]).toMatchObject({
				line: 2,
				status: "rejected",
				externalRef: column === "external_ref" ? null : "ref",
				reason: { code: "invalid_input", exitCode: 2, path: `line.2.${column}` },
			})
			expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
		}
	})

	it("treats an only-commas row as seven blank cells, not a skipped line", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const res = await traj(["tx", "import", csv(home, "commas.csv", [HEADER, ",,,,,,"]), "--json"])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "line.2.date" })
		expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
	})

	it("keeps the core's code and exit class for a bad date, account or amount", async () => {
		const cases = [
			{
				cells: ["2026-02-30", "Cash", "Food", "1", "", "d", ""],
				code: "INVALID_DATE",
				path: "line.2.date",
				exit: 3,
			},
			{
				cells: ["2026-03-01", "Nope", "Food", "1", "", "f", ""],
				code: "UNKNOWN_ACCOUNT",
				path: "line.2.from",
				exit: 3,
			},
			{
				cells: ["2026-03-01", "Cash", "Nope", "1", "", "t", ""],
				code: "UNKNOWN_ACCOUNT",
				path: "line.2.to",
				exit: 3,
			},
			{
				cells: ["2026-03-01", "Cash", "Food", "abc", "", "a", ""],
				code: "invalid_input",
				path: "line.2.amount",
				exit: 2,
			},
			{
				cells: ["2026-03-01", "Cash", "Food", "1.001", "", "p", ""],
				code: "INVALID_AMOUNT",
				path: "line.2.amount",
				exit: 3,
			},
			{
				cells: ["2026-03-01", "Cash", "Food", "99999999999999999999", "", "o", ""],
				code: "INVALID_AMOUNT",
				path: "line.2.amount",
				exit: 3,
			},
			{
				cells: ["2026-03-01", "Cash", "Food", "-1", "", "n", ""],
				code: "NEGATIVE_AMOUNT",
				path: "line.2.amount",
				exit: 3,
			},
			{
				cells: ["2026-03-01", "Cash", "Food", "0", "", "z", ""],
				code: "ZERO_AMOUNT_POSTING",
				path: "line.2.amount",
				exit: 3,
			},
		]
		for (const entry of cases) {
			const home = tempHome()
			const traj = cli(home)
			await seeded(traj)
			const res = await traj([
				"tx",
				"import",
				csv(home, "bad.csv", [HEADER, row(entry.cells)]),
				"--json",
			])
			expect(res.code).toBe(entry.exit)
			const error = errorOf(res)
			expect(error).toMatchObject({ code: entry.code, exitCode: entry.exit, path: entry.path })
			expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
		}
	})

	it("rejects an archived account and a header account at the row's column", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		await account(traj, "Bank")
		await traj([
			"account",
			"add",
			"Savings",
			"--type",
			"asset",
			"--currency",
			"THB",
			"--parent",
			"Bank",
		])
		await account(traj, "Old", "expense")
		await traj(["account", "close", "Old"])
		const header = await traj([
			"tx",
			"import",
			csv(home, "header.csv", [HEADER, row(["2026-03-01", "Cash", "Bank", "1", "", "h", ""])]),
			"--json",
		])
		expect(header.code).toBe(3)
		expect(errorOf(header)).toMatchObject({
			code: "NON_LEAF_ACCOUNT",
			path: "line.2.to",
			details: { rows: [{ line: 2, reason: { code: "NON_LEAF_ACCOUNT", path: "line.2.to" } }] },
		})
		const archived = await traj([
			"tx",
			"import",
			csv(home, "archived.csv", [HEADER, row(["2026-03-01", "Cash", "Old", "1", "", "a", ""])]),
			"--json",
		])
		expect(archived.code).toBe(3)
		expect(errorOf(archived)).toMatchObject({
			code: "account_archived",
			path: "line.2.to",
			details: { rows: [{ line: 2, reason: { code: "account_archived", path: "line.2.to" } }] },
		})
		expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
	})
})
