import { describe, expect, it } from "bun:test"
import { errorOf } from "./test-support"
import { accounts, cli, ledgerHome } from "./tx-test-support"

describe("tx add --opening", () => {
	it("refuses a positive opening on a liability, in the real run and the dry run alike", async () => {
		const traj = cli(ledgerHome())
		await accounts(traj, [
			["Opening", "equity"],
			["Student loan", "liability"],
		])
		const argv = [
			"tx",
			"add",
			"--opening",
			"--from",
			"Opening",
			"--to",
			"Student loan",
			"--amount",
			"300000.00",
			"--date",
			"2026-11-01",
			"--json",
		]
		const refused = await traj(argv)
		expect(refused.code).toBe(3)
		expect(errorOf(refused)).toMatchObject({
			code: "liability_opening_positive",
			exitCode: 3,
			path: "--amount",
		})
		expect(errorOf(refused).message).toContain('"Student loan" is a liability')
		expect(errorOf(refused).message).toContain("enter the debt as a negative amount")
		expect(errorOf(refused).hint).toContain("--amount -300000.00")
		const dry = await traj([...argv, "--dry-run"])
		expect(dry.code).toBe(3)
		expect(errorOf(dry).code).toBe("liability_opening_positive")
		const networth = JSON.parse(
			(await traj(["report", "networth", "--as-of", "2026-11-30", "--json"])).out,
		)
		expect(networth.totals).toEqual([{ currency: "THB", amount: "0.00" }])
	})

	it("opens a liability with a negative amount, so net worth falls by the debt", async () => {
		const traj = cli(ledgerHome())
		await accounts(traj, [
			["Opening", "equity"],
			["Student loan", "liability"],
		])
		const res = await traj([
			"tx",
			"add",
			"--opening",
			"--from",
			"Opening",
			"--to",
			"Student loan",
			"--amount",
			"-300000.00",
			"--date",
			"2026-11-01",
			"--json",
		])
		expect(res.code).toBe(0)
		const { transaction } = JSON.parse(res.out)
		expect(transaction.postings.map((p: { amount: string }) => p.amount)).toEqual([
			"-300000.00",
			"300000.00",
		])
		const networth = JSON.parse(
			(await traj(["report", "networth", "--as-of", "2026-11-30", "--json"])).out,
		)
		expect(networth.totals).toEqual([{ currency: "THB", amount: "-300000.00" }])
	})

	it("keeps the core's header-account refusal ahead of the sign rule", async () => {
		const traj = cli(ledgerHome())
		await accounts(traj, [
			["Opening", "equity"],
			["Loans", "liability"],
		])
		const child = await traj([
			"account",
			"add",
			"Car loan",
			"--type",
			"liability",
			"--currency",
			"THB",
			"--parent",
			"Loans",
			"--json",
		])
		expect(child.code).toBe(0)
		const res = await traj([
			"tx",
			"add",
			"--opening",
			"--from",
			"Opening",
			"--to",
			"Loans",
			"--amount",
			"100.00",
			"--date",
			"2026-11-01",
			"--json",
		])
		expect(res.code).toBe(3)
		expect(errorOf(res).code).toBe("NON_LEAF_ACCOUNT")
	})
})
