import { describe, expect, it } from "bun:test"
import { accounts, cli, tempHome, UUID_V7 } from "./tx-test-support"

describe("tx add", () => {
	it("records a simple transfer between two accounts by name", async () => {
		const traj = cli(tempHome())
		const opened = await accounts(traj, [
			["Cash", "asset"],
			["Food", "expense"],
		])
		const res = await traj([
			"tx",
			"add",
			"--from",
			"Cash",
			"--to",
			"Food",
			"--amount",
			"120.50",
			"--date",
			"2026-03-01",
			"--project",
			"lunch",
			"--external-ref",
			"card:1",
			"--json",
		])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.dryRun).toBe(false)
		expect(data.status).toBe("added")
		expect(data.transaction).toMatchObject({
			date: "2026-03-01",
			memo: null,
			linkedTo: null,
			externalRef: "card:1",
			version: 1,
		})
		expect(data.transaction.id).toMatch(UUID_V7)
		expect(data.transaction.postings).toEqual([
			{
				ordinal: 0,
				accountId: opened["Food"]?.id,
				amount: "120.50",
				currency: "THB",
				dimensions: { project: "lunch" },
			},
			{
				ordinal: 1,
				accountId: opened["Cash"]?.id,
				amount: "-120.50",
				currency: "THB",
				dimensions: { project: "lunch" },
			},
		])
	})

	it("records an opening balance against equity, signed so an overdrawn asset opens negative", async () => {
		const traj = cli(tempHome())
		const opened = await accounts(traj, [
			["Cash", "asset"],
			["Overdrawn", "asset"],
			["Opening", "equity"],
		])
		const positive = await traj([
			"tx",
			"add",
			"--opening",
			"--from",
			"Opening",
			"--to",
			"Cash",
			"--amount",
			"1000.00",
			"--date",
			"2026-01-01",
			"--json",
		])
		expect(positive.code).toBe(0)
		const openedPostings = JSON.parse(positive.out).transaction.postings
		expect(openedPostings.map((p: { amount: string }) => p.amount)).toEqual(["1000.00", "-1000.00"])
		expect(openedPostings.map((p: { accountId: string }) => p.accountId)).toEqual([
			opened["Cash"]?.id,
			opened["Opening"]?.id,
		])
		const negative = await traj([
			"tx",
			"add",
			"--opening",
			"--from",
			"Opening",
			"--to",
			"Overdrawn",
			"--amount",
			"-250.00",
			"--date",
			"2026-01-01",
			"--json",
		])
		expect(negative.code).toBe(0)
		const overdrawn = JSON.parse(negative.out).transaction.postings
		expect(overdrawn.map((p: { amount: string }) => p.amount)).toEqual(["-250.00", "250.00"])
		expect(overdrawn.map((p: { accountId: string }) => p.accountId)).toEqual([
			opened["Overdrawn"]?.id,
			opened["Opening"]?.id,
		])
	})
})
