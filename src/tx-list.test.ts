import { describe, expect, it } from "bun:test"
import { must, mustOpen } from "./store/testing"
import { addTx } from "./tx-read-test-support"
import { accounts, cli, tempHome } from "./tx-test-support"

describe("tx list", () => {
	it("lists a transaction once with both accounts named", async () => {
		const traj = cli(tempHome())
		const opened = await accounts(traj, [
			["Cash", "asset"],
			["Food", "expense"],
		])
		const added = await addTx(traj, "Cash", "Food", "120.50", "2026-03-01")
		const res = await traj(["tx", "list", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.transactions).toHaveLength(1)
		expect(data.transactions[0]).toEqual({
			id: added.id,
			date: "2026-03-01",
			memo: null,
			linkedTo: null,
			postings: [
				{
					ordinal: 0,
					account: { id: opened["Food"]?.id, name: "Food" },
					amount: "120.50",
					currency: "THB",
					dimensions: null,
				},
				{
					ordinal: 1,
					account: { id: opened["Cash"]?.id, name: "Cash" },
					amount: "-120.50",
					currency: "THB",
					dimensions: null,
				},
			],
		})
	})

	it("orders by date and then by id, whatever the insertion order", async () => {
		const home = tempHome()
		const store = mustOpen(home)
		const cash = must(store.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
		const food = must(store.createAccount({ name: "Food", type: "expense", currency: "THB" }))
		const add = (date: string) =>
			must(
				store.addTransaction({
					date,
					postings: [
						{ accountId: food.account.id, amount: 100, currency: "THB" },
						{ accountId: cash.account.id, amount: -100, currency: "THB" },
					],
				}),
			).tx
		const later = add("2026-03-02")
		const sameDayFirst = add("2026-03-01")
		const sameDaySecond = add("2026-03-01")
		store.close()
		// The stepping clock makes later ids larger, so insertion order is also id order here.
		expect(later.id < sameDayFirst.id).toBe(true)
		expect(sameDayFirst.id < sameDaySecond.id).toBe(true)
		const res = await cli(home)(["tx", "list", "--json"])
		expect(JSON.parse(res.out).transactions.map((tx: { id: string }) => tx.id)).toEqual([
			sameDayFirst.id,
			sameDaySecond.id,
			later.id,
		])
	})

	it("includes the days --since and --until name", async () => {
		const traj = cli(tempHome())
		await accounts(traj, [
			["Cash", "asset"],
			["Food", "expense"],
		])
		await addTx(traj, "Cash", "Food", "1.00", "2026-02-28")
		await addTx(traj, "Cash", "Food", "2.00", "2026-03-01")
		await addTx(traj, "Cash", "Food", "3.00", "2026-03-02")
		const res = await traj([
			"tx",
			"list",
			"--since",
			"2026-03-01",
			"--until",
			"2026-03-02",
			"--json",
		])
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out).transactions.map((tx: { date: string }) => tx.date)).toEqual([
			"2026-03-01",
			"2026-03-02",
		])
	})

	it("finds a transaction from either side with --account", async () => {
		const traj = cli(tempHome())
		const opened = await accounts(traj, [
			["Cash", "asset"],
			["Food", "expense"],
			["Unused", "expense"],
		])
		await addTx(traj, "Cash", "Food", "10.00", "2026-03-01")
		for (const account of ["Food", "Cash", opened["Cash"]?.id]) {
			const res = await traj(["tx", "list", "--account", account ?? "", "--json"])
			expect(res.code).toBe(0)
			expect(JSON.parse(res.out).transactions).toHaveLength(1)
		}
		const unused = await traj(["tx", "list", "--account", "Unused", "--json"])
		expect(unused.code).toBe(0)
		expect(JSON.parse(unused.out).transactions).toEqual([])
	})

	it("reports an unknown --account as not_found, not UNKNOWN_ACCOUNT", async () => {
		const traj = cli(tempHome())
		await accounts(traj, [
			["Cash", "asset"],
			["Food", "expense"],
		])
		const res = await traj(["tx", "list", "--account", "NOPE", "--json"])
		expect(res.code).toBe(4)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "not_found",
			exitCode: 4,
			details: { resource: "account" },
		})
	})

	it("keeps a missing account on a posting as UNKNOWN_ACCOUNT", async () => {
		const traj = cli(tempHome())
		await accounts(traj, [["Cash", "asset"]])
		const res = await traj([
			"tx",
			"add",
			"--from",
			"Cash",
			"--to",
			"NOPE",
			"--amount",
			"1.00",
			"--date",
			"2026-03-01",
			"--json",
		])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "UNKNOWN_ACCOUNT",
			exitCode: 3,
		})
	})
})
