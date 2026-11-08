import { describe, expect, it } from "bun:test"
import { addTx } from "./tx-read-test-support"
import { accounts, cli, tempHome } from "./tx-test-support"

describe("tx list filters", () => {
	it("matches the project dimension's value with --project", async () => {
		const home = tempHome()
		const traj = cli(home)
		const opened = await accounts(traj, [
			["Cash", "asset"],
			["Food", "expense"],
		])
		const tagged = await addTx(traj, "Cash", "Food", "12.00", "2026-03-01", "lunch")
		await addTx(traj, "Cash", "Food", "20.00", "2026-03-02")
		await addTx(traj, "Cash", "Food", "30.00", "2026-03-03", "rent")
		const document = JSON.stringify({
			date: "2026-03-04",
			postings: [
				{
					account: "Food",
					amount: "30.00",
					currency: "THB",
					dimensions: { project: "lunch" },
				},
				{ account: "Cash", amount: "-30.00", currency: "THB" },
			],
		})
		const mixed = await cli(home, document)(["tx", "add", "--postings", "-", "--json"])
		expect(mixed.code).toBe(0)
		const mixedId = JSON.parse(mixed.out).transaction.id
		const res = await traj(["tx", "list", "--project", "lunch", "--json"])
		expect(res.code).toBe(0)
		const txs = JSON.parse(res.out).transactions
		expect(txs.map((tx: { id: string }) => tx.id)).toEqual([tagged.id, mixedId])
		for (const posting of txs[0].postings) {
			expect(posting.dimensions).toEqual({ project: "lunch" })
		}
		// The mixed transaction keeps only its tagged posting; the untagged side is sliced away.
		expect(txs[1].postings).toEqual([
			{
				ordinal: 0,
				account: { id: opened["Food"]?.id, name: "Food" },
				amount: "30.00",
				currency: "THB",
				dimensions: { project: "lunch" },
			},
		])
		// `--account` matches the transaction through its Cash side while `--project` slices
		// its postings: the two filters are independent, not one posting.
		const both = await traj(["tx", "list", "--account", "Cash", "--project", "lunch", "--json"])
		expect(both.code).toBe(0)
		const combined = JSON.parse(both.out).transactions
		expect(combined.map((tx: { id: string }) => tx.id)).toEqual([tagged.id, mixedId])
		expect(combined[1].postings.map((p: { amount: string }) => p.amount)).toEqual(["30.00"])
	})

	it("rejects a date bound that is not a real calendar date", async () => {
		const traj = cli(tempHome())
		for (const [flag, value] of [
			["--since", "garbage"],
			["--since", "2026-3-1"],
			["--until", "2026-02-30"],
		] as const) {
			const res = await traj(["tx", "list", flag, value, "--json"])
			expect(res.code).toBe(3)
			expect(JSON.parse(res.err).error).toMatchObject({
				code: "INVALID_DATE",
				exitCode: 3,
				path: flag.slice(2),
			})
		}
	})

	it("rejects a period that starts after it ends", async () => {
		const traj = cli(tempHome())
		const res = await traj([
			"tx",
			"list",
			"--since",
			"2026-03-02",
			"--until",
			"2026-03-01",
			"--json",
		])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "INVALID_PERIOD",
			exitCode: 3,
			path: "since",
		})
	})
})
