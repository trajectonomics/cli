import { describe, expect, it } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { accounts, cli, tempHome } from "./tx-test-support"

const salary = {
	date: "2026-03-31",
	memo: "March salary",
	externalRef: "payroll:2026-03",
	postings: [
		{
			account: "Bank",
			amount: "80000.00",
			currency: "THB",
			dimensions: { project: "acme" },
		},
		{
			account: "Salary",
			amount: "-100000.00",
			currency: "THB",
			dimensions: { project: "acme" },
		},
		{ account: "Tax Payable", amount: "-5000.00", currency: "THB" },
		{
			account: "Owner Pay",
			amount: "25000.00",
			currency: "THB",
			dimensions: { project: "acme", role: "owner" },
		},
	],
}

const loan = {
	date: "2026-04-01",
	memo: "Loan repayment",
	postings: [
		{ account: "Loan", amount: "10000.00", currency: "THB" },
		{ account: "Interest", amount: "2000.00", currency: "THB" },
		{ account: "Bank", amount: "-12000.00", currency: "THB" },
	],
}

describe("tx add document", () => {
	it("adds a four-posting salary from stdin with every dimension and sign intact", async () => {
		const traj = cli(tempHome(), JSON.stringify(salary))
		const opened = await accounts(traj, [
			["Bank", "asset"],
			["Salary", "income"],
			["Tax Payable", "liability"],
			["Owner Pay", "expense"],
		])
		const res = await traj(["tx", "add", "--postings", "-", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.transaction).toMatchObject({
			date: "2026-03-31",
			memo: "March salary",
			externalRef: "payroll:2026-03",
		})
		expect(data.transaction.postings).toEqual([
			{
				ordinal: 0,
				accountId: opened["Bank"]?.id,
				amount: "80000.00",
				currency: "THB",
				dimensions: { project: "acme" },
			},
			{
				ordinal: 1,
				accountId: opened["Salary"]?.id,
				amount: "-100000.00",
				currency: "THB",
				dimensions: { project: "acme" },
			},
			{
				ordinal: 2,
				accountId: opened["Tax Payable"]?.id,
				amount: "-5000.00",
				currency: "THB",
				dimensions: null,
			},
			{
				ordinal: 3,
				accountId: opened["Owner Pay"]?.id,
				amount: "25000.00",
				currency: "THB",
				dimensions: { project: "acme", role: "owner" },
			},
		])
	})

	it("adds a loan split from a file", async () => {
		const traj = cli(tempHome())
		const opened = await accounts(traj, [
			["Bank", "asset"],
			["Loan", "liability"],
			["Interest", "expense"],
		])
		const file = join(mkdtempSync(join(tmpdir(), "traj-doc-")), "loan.json")
		writeFileSync(file, JSON.stringify(loan))
		const res = await traj(["tx", "add", "--postings", file, "--json"])
		expect(res.code).toBe(0)
		const postings = JSON.parse(res.out).transaction.postings
		expect(postings).toEqual([
			{
				ordinal: 0,
				accountId: opened["Loan"]?.id,
				amount: "10000.00",
				currency: "THB",
				dimensions: null,
			},
			{
				ordinal: 1,
				accountId: opened["Interest"]?.id,
				amount: "2000.00",
				currency: "THB",
				dimensions: null,
			},
			{
				ordinal: 2,
				accountId: opened["Bank"]?.id,
				amount: "-12000.00",
				currency: "THB",
				dimensions: null,
			},
		])
	})
})
