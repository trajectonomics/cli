import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { must, mustOpen, tempHome } from "./testing"
import type { NewAccount, NewTransaction, Store } from "./types"

function setup() {
	const store = mustOpen(tempHome())
	const open = (input: NewAccount) => must(store.createAccount(input)).account.id
	const cash = open({ name: "Cash", type: "asset", currency: "THB" })
	const food = open({ name: "Food", type: "expense", currency: "THB" })
	const lunch: NewTransaction = {
		date: "2026-03-01",
		postings: [
			{ accountId: food, amount: 12050, currency: "THB" },
			{ accountId: cash, amount: -12050, currency: "THB" },
		],
	}
	return { store, cash, food, lunch }
}

function totalsByAccount(store: Store): Map<string, number> {
	const totals = new Map<string, number>()
	for (const posting of must(store.listPostings({ sort: "tx_id" }))) {
		totals.set(posting.accountId, (totals.get(posting.accountId) ?? 0) + posting.amount)
	}
	return totals
}

function voided(store: Store, id: string, date: string) {
	const outcome = must(store.voidTransaction(id, { date }))
	if (outcome.status === "not_found") throw new Error(`transaction ${id} was not found`)
	return outcome
}

describe("voidTransaction", () => {
	it("nets the accounts' postings for the original and its reversal to zero", () => {
		const { store, cash, food, lunch } = setup()
		const original = must(store.addTransaction(lunch)).tx
		const reversal = voided(store, original.id, "2026-03-02")
		expect(reversal.status).toBe("voided")
		expect(totalsByAccount(store)).toEqual(
			new Map([
				[cash, 0],
				[food, 0],
			]),
		)
	})

	it("returns the existing correction and writes no row when one already stands", () => {
		const { store, lunch } = setup()
		const original = must(store.addTransaction(lunch)).tx
		const first = voided(store, original.id, "2026-03-02")
		const again = voided(store, original.id, "2026-03-03")
		expect(again).toMatchObject({ status: "already_corrected", tx: { id: first.tx.id } })
		expect(must(store.listTransactions({ sort: "date" }))).toHaveLength(2)
		expect(must(store.listPostings({ sort: "tx_id" }))).toHaveLength(4)
	})

	it("restores the original when its reversal is itself voided", () => {
		const { store, cash, food, lunch } = setup()
		const original = must(store.addTransaction(lunch)).tx
		const first = voided(store, original.id, "2026-03-02").tx
		voided(store, first.id, "2026-03-03")
		const restored = voided(store, original.id, "2026-03-04")
		expect(restored.status).toBe("voided")
		expect(must(store.listTransactions({ sort: "date" }))).toHaveLength(4)
		expect(totalsByAccount(store)).toEqual(
			new Map([
				[cash, 0],
				[food, 0],
			]),
		)
	})

	it("refuses a reversal into an account archived after the original", () => {
		const { store, cash, lunch } = setup()
		const original = must(store.addTransaction(lunch)).tx
		must(store.closeAccount(cash))
		const outcome = store.voidTransaction(original.id, { date: "2026-03-02" })
		if (!isAppError(outcome)) throw new Error("expected account_archived")
		expect(outcome.body).toMatchObject({ code: "account_archived", exitCode: 3 })
	})
})
