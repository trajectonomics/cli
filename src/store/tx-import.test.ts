import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { must, mustOpen, steppingClock, tempHome } from "./testing"
import { importRejections } from "./tx-import"
import type { NewTransaction, Store } from "./types"

function setup() {
	const store = mustOpen(tempHome(), steppingClock())
	const open = (name: string, type: "asset" | "expense" | "equity") =>
		must(store.createAccount({ name, type, currency: "THB" })).account.id
	const cash = open("Cash", "asset")
	const food = open("Food", "expense")
	const salary = open("Salary", "equity")
	const lunch = (ref: string, amount = 12050): NewTransaction => ({
		date: "2026-03-01",
		externalRef: ref,
		memo: "Lunch",
		postings: [
			{ accountId: food, amount, currency: "THB" },
			{ accountId: cash, amount: -amount, currency: "THB" },
		],
	})
	return { store, cash, food, salary, lunch }
}

function counts(store: Store) {
	return {
		transactions: must(store.listTransactions({ sort: "date" })).length,
		postings: must(store.listPostings({ sort: "tx_id" })).length,
	}
}

/** The batch's rejection rows, or a test failure describing what came back instead. */
function rejectionsOf(outcome: unknown, store: Store) {
	if (!isAppError(outcome)) {
		throw new Error(`expected a rejection, wrote ${JSON.stringify(counts(store))}`)
	}
	const rows = importRejections(outcome)
	if (rows === undefined) throw new Error("the envelope carries no details.rows")
	return rows
}

describe("importTransactions", () => {
	it("writes every row in input order, each with its own external reference", () => {
		const { store, lunch, cash, food } = setup()
		const written = must(store.importTransactions([lunch("a"), lunch("b", 5000), lunch("c", 100)]))
		expect(written.map((row) => row.status)).toEqual(["added", "added", "added"])
		expect(written.map((row) => row.tx.externalRef)).toEqual(["a", "b", "c"])
		expect(written.map((row) => row.tx.memo)).toEqual(["Lunch", "Lunch", "Lunch"])
		// The command's path rewriting counts on the debit (to) at ordinal 0 and the credit at 1.
		expect(written[0]?.postings.map((posting) => posting.accountId)).toEqual([food, cash])
		expect(counts(store)).toEqual({ transactions: 3, postings: 6 })
	})

	it("rolls the whole batch back when one row is rejected, writing none", () => {
		const { store, lunch, salary } = setup()
		const closed = must(store.closeAccount(salary))
		if (closed.status === "not_found") throw new Error("the account was not found")
		const archived = closed.account.id
		const outcome = store.importTransactions([
			lunch("ok"),
			{
				date: "2026-03-01",
				externalRef: "bad",
				postings: [
					{ accountId: archived, amount: 100, currency: "THB" },
					{ accountId: archived, amount: -100, currency: "THB" },
				],
			},
		])
		const rows = rejectionsOf(outcome, store)
		expect(rows.map((row) => row.index)).toEqual([1])
		expect(rows[0]?.reason).toMatchObject({ code: "account_archived", exitCode: 3 })
		expect(counts(store)).toEqual({ transactions: 0, postings: 0 })
	})

	it("collects every rejection in index order, including a core validation error", () => {
		const { store, lunch, food, cash } = setup()
		const outcome = store.importTransactions([
			{
				...lunch("zero"),
				postings: [
					{ accountId: food, amount: 0, currency: "THB" },
					{ accountId: cash, amount: 0, currency: "THB" },
				],
			},
			lunch("fine"),
			{
				...lunch("unknown"),
				postings: [
					{ accountId: "01940000-0000-7000-8000-00000000dead", amount: 1, currency: "THB" },
				],
			},
		])
		const rows = rejectionsOf(outcome, store)
		expect(rows.map((row) => row.index)).toEqual([0, 2])
		expect(rows.map((row) => row.reason.code)).toEqual(["ZERO_AMOUNT_POSTING", "UNKNOWN_ACCOUNT"])
		expect(counts(store)).toEqual({ transactions: 0, postings: 0 })
	})

	it("replays a repeated reference within the batch: identical is a duplicate, changed a conflict", () => {
		const { store, lunch } = setup()
		const written = must(store.importTransactions([lunch("same"), lunch("same")]))
		expect(written.map((row) => row.status)).toEqual(["added", "duplicate"])
		expect(written[0]?.tx.id).toBe(written[1]?.tx.id)
		expect(counts(store)).toEqual({ transactions: 1, postings: 2 })

		const conflict = store.importTransactions([lunch("same", 999)])
		const rows = rejectionsOf(conflict, store)
		expect(rows[0]?.reason).toMatchObject({ code: "external_ref_conflict", exitCode: 5 })
		expect(counts(store)).toEqual({ transactions: 1, postings: 2 })
	})

	it("keeps an imported-by-the-batch reference visible to a later row of the same batch", () => {
		const { store, lunch } = setup()
		const written = must(store.importTransactions([lunch("x", 100), lunch("x", 100), lunch("y")]))
		expect(written.map((row) => row.status)).toEqual(["added", "duplicate", "added"])
		expect(written[1]?.tx.id).toBe(written[0]?.tx.id)
	})

	it("treats a transaction voided after its import as a duplicate", () => {
		const { store, lunch } = setup()
		const original = must(store.importTransactions([lunch("voided")]))[0]?.tx
		if (original === undefined) throw new Error("the import wrote no row")
		must(store.voidTransaction(original.id, { date: "2026-03-02" }))
		const before = counts(store)
		const again = must(store.importTransactions([lunch("voided")]))
		expect(again[0]?.status).toBe("duplicate")
		expect(again[0]?.tx.id).toBe(original.id)
		expect(counts(store)).toEqual(before)
	})

	it("reads the clock once, so every row it adds shares one timestamp", () => {
		const { store, lunch } = setup()
		const written = must(store.importTransactions([lunch("one"), lunch("two"), lunch("three")]))
		const stamps = new Set(written.map((row) => `${row.tx.createdAt}|${row.tx.updatedAt}`))
		expect(stamps.size).toBe(1)
	})

	it("writes nothing on a dry run and still returns the rows it would have written", () => {
		const { store, lunch } = setup()
		const written = must(store.importTransactions([lunch("dry"), lunch("dry")], { dryRun: true }))
		expect(written.map((row) => row.status)).toEqual(["added", "duplicate"])
		expect(counts(store)).toEqual({ transactions: 0, postings: 0 })
	})
})
