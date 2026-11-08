import { describe, expect, it } from "bun:test"
import { must, mustOpen } from "./store/testing"
import { addTx } from "./tx-read-test-support"
import { accounts, cli, tempHome } from "./tx-test-support"

describe("tx show", () => {
	it("shows a transaction with both accounts named and no links yet", async () => {
		const traj = cli(tempHome())
		const opened = await accounts(traj, [
			["Cash", "asset"],
			["Food", "expense"],
		])
		const added = await addTx(traj, "Cash", "Food", "120.50", "2026-03-01")
		const res = await traj(["tx", "show", added.id, "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.transaction).toMatchObject({
			id: added.id,
			date: "2026-03-01",
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
		expect(data.links).toEqual({ corrects: null, correctedBy: [] })
	})

	it("reports links in both directions", async () => {
		const home = tempHome()
		const store = mustOpen(home)
		const cash = must(store.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
		const food = must(store.createAccount({ name: "Food", type: "expense", currency: "THB" }))
		const postings = [
			{ accountId: food.account.id, amount: 100, currency: "THB" },
			{ accountId: cash.account.id, amount: -100, currency: "THB" },
		]
		const original = must(store.addTransaction({ date: "2026-03-01", postings })).tx
		const reversal = must(
			store.addTransaction({
				date: "2026-03-02",
				linkedTo: original.id,
				postings: postings.map((p) => ({ ...p, amount: -p.amount })),
			}),
		).tx
		store.close()
		const traj = cli(home)
		const listed = JSON.parse((await traj(["tx", "list", "--json"])).out)
		expect(listed.transactions.map((tx: { id: string }) => tx.id)).toEqual([
			original.id,
			reversal.id,
		])
		const shown = JSON.parse((await traj(["tx", "show", original.id, "--json"])).out)
		expect(shown.links).toEqual({
			corrects: null,
			correctedBy: [{ id: reversal.id, date: "2026-03-02" }],
		})
		const back = JSON.parse((await traj(["tx", "show", reversal.id, "--json"])).out)
		expect(back.links).toEqual({
			corrects: { id: original.id, date: "2026-03-01" },
			correctedBy: [],
		})
	})

	it("reports an unknown transaction as not_found", async () => {
		const traj = cli(tempHome())
		const res = await traj(["tx", "show", "01940000-0000-7000-8000-000000000000", "--json"])
		expect(res.code).toBe(4)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "not_found",
			exitCode: 4,
			details: { resource: "transaction" },
		})
	})
})
