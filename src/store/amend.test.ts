import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { must, mustOpen, tempHome } from "./testing"
import type { NewAmendment, NewTransaction, Store, TxAmended } from "./types"

function setup() {
	const store = mustOpen(tempHome())
	const open = (name: string, type: "asset" | "expense") =>
		must(store.createAccount({ name, type, currency: "THB" })).account.id
	const cash = open("Cash", "asset")
	const food = open("Food", "expense")
	const lunch: NewTransaction = {
		date: "2026-03-01",
		postings: [
			{ accountId: food, amount: 12050, currency: "THB" },
			{ accountId: cash, amount: -12050, currency: "THB" },
		],
	}
	return { store, cash, food, lunch }
}

function replacement(cash: string, food: string, amount = 10000): NewTransaction {
	return {
		date: "2026-03-02",
		postings: [
			{ accountId: food, amount, currency: "THB" },
			{ accountId: cash, amount: -amount, currency: "THB" },
		],
	}
}

function amended(
	store: Store,
	id: string,
	input: NewAmendment,
): Exclude<TxAmended, { status: "not_found" }> {
	const outcome = must(store.amendTransaction(id, input))
	if (outcome.status === "not_found") throw new Error(`transaction ${id} was not found`)
	return outcome
}

describe("amendTransaction", () => {
	it("writes the reversal and the replacement in one write, both linked and both named", () => {
		const { store, cash, food, lunch } = setup()
		const original = must(store.addTransaction(lunch)).tx
		const outcome = amended(store, original.id, { replacement: replacement(cash, food) })
		expect(outcome.status).toBe("amended")
		if (outcome.status !== "amended") throw new Error("expected an amendment")

		expect(outcome.reversal.tx).toMatchObject({
			date: "2026-03-02",
			linkedTo: original.id,
			correctionKind: "reversal",
			version: 1,
		})
		expect(outcome.replacement.tx).toMatchObject({
			date: "2026-03-02",
			linkedTo: original.id,
			correctionKind: "replacement",
			version: 1,
		})
		expect(outcome.reversal.tx.id).not.toBe(outcome.replacement.tx.id)
		expect(must(store.listTransactions({ sort: "date" }))).toHaveLength(3)
		expect(must(store.listPostings({ sort: "tx_id" }))).toHaveLength(6)
	})

	it("reads the clock once, so both rows carry one timestamp", () => {
		const { store, cash, food, lunch } = setup()
		const original = must(store.addTransaction(lunch)).tx
		const outcome = amended(store, original.id, { replacement: replacement(cash, food) })
		if (outcome.status !== "amended") throw new Error("expected an amendment")
		expect(outcome.reversal.tx.createdAt).toBe(outcome.replacement.tx.createdAt)
		expect(outcome.reversal.tx.updatedAt).toBe(outcome.replacement.tx.updatedAt)
	})

	it("writes neither row when the replacement fails validation", () => {
		const { store, cash, food, lunch } = setup()
		const original = must(store.addTransaction(lunch)).tx
		const unbalanced = {
			...replacement(cash, food),
			postings: [
				{ accountId: food, amount: 10000, currency: "THB" },
				{ accountId: cash, amount: -9000, currency: "THB" },
			],
		}
		const outcome = store.amendTransaction(original.id, { replacement: unbalanced })
		if (!isAppError(outcome)) throw new Error("expected UNBALANCED_TRANSACTION")
		expect(outcome.body).toMatchObject({ code: "UNBALANCED_TRANSACTION", exitCode: 3 })
		expect(must(store.listTransactions({ sort: "date" }))).toHaveLength(1)
		expect(must(store.listPostings({ sort: "tx_id" }))).toHaveLength(2)
	})

	it("refuses the original's own external reference as a conflict, writing nothing", () => {
		const { store, cash, food } = setup()
		const original = must(
			store.addTransaction({
				date: "2026-03-01",
				externalRef: "kbank:2026-03-01:0001",
				postings: [
					{ accountId: food, amount: 12050, currency: "THB" },
					{ accountId: cash, amount: -12050, currency: "THB" },
				],
			}),
		).tx
		const carried = { ...replacement(cash, food), externalRef: "kbank:2026-03-01:0001" }
		const outcome = store.amendTransaction(original.id, { replacement: carried })
		if (!isAppError(outcome)) throw new Error("expected external_ref_conflict")
		expect(outcome.body).toMatchObject({
			code: "external_ref_conflict",
			exitCode: 5,
			path: "externalRef",
			details: { txId: original.id },
		})
		expect(must(store.listTransactions({ sort: "date" }))).toHaveLength(1)
	})

	it("refuses a reference another transaction already uses", () => {
		const { store, cash, food, lunch } = setup()
		const original = must(store.addTransaction(lunch)).tx
		must(store.addTransaction({ ...lunch, externalRef: "taken" }))
		const outcome = store.amendTransaction(original.id, {
			replacement: { ...replacement(cash, food), externalRef: "taken" },
		})
		if (!isAppError(outcome)) throw new Error("expected external_ref_conflict")
		expect(outcome.body).toMatchObject({ code: "external_ref_conflict", exitCode: 5 })
	})

	it("reports a standing correction as already_corrected and writes no row", () => {
		const { store, cash, food, lunch } = setup()
		const original = must(store.addTransaction(lunch)).tx
		const first = amended(store, original.id, { replacement: replacement(cash, food) })
		if (first.status !== "amended") throw new Error("expected an amendment")
		const again = amended(store, original.id, { replacement: replacement(cash, food) })
		expect(again.status).toBe("already_corrected")
		if (again.status !== "already_corrected") throw new Error("expected already_corrected")
		// The reversal is the row that cancels the original, so it is the one reported.
		expect(again.tx.id).toBe(first.reversal.tx.id)
		expect(must(store.listTransactions({ sort: "date" }))).toHaveLength(3)
		expect(must(store.listPostings({ sort: "tx_id" }))).toHaveLength(6)
	})
})
