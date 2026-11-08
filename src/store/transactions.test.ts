import { describe, expect, it } from "bun:test"
import { type AppError, isAppError } from "../errors"
import { must, mustOpen, tempHome } from "./testing"
import type { NewAccount, Store } from "./types"

function setup() {
	const store = mustOpen(tempHome())
	const open = (input: NewAccount) => must(store.createAccount(input)).account.id
	const cash = open({ name: "Cash", type: "asset", currency: "THB" })
	const food = open({ name: "Food", type: "expense", currency: "THB" })
	return { store, cash, food }
}

function lunch(cash: string, food: string, amount = 12050) {
	return {
		date: "2026-03-01",
		memo: "ข้าวมันไก่",
		postings: [
			{ accountId: food, amount, currency: "THB", dimensions: { project: "x", city: "bkk" } },
			{ accountId: cash, amount: -amount, currency: "THB" },
		],
	}
}

function rejection(outcome: unknown): AppError["body"] {
	if (!isAppError(outcome)) throw new Error(`expected a rejection, got ${JSON.stringify(outcome)}`)
	return outcome.body
}

function counts(store: Store) {
	return [
		must(store.listTransactions({ sort: "id" })).length,
		must(store.listPostings({ sort: "tx_id" })).length,
	]
}

describe("transactions", () => {
	it("adds a balanced transaction with ordered postings in integer minor units", () => {
		const { store, cash, food } = setup()
		const added = must(store.addTransaction(lunch(cash, food)))
		expect(added.status).toBe("added")
		expect(added.tx).toMatchObject({
			date: "2026-03-01",
			memo: "ข้าวมันไก่",
			linkedTo: null,
			externalRef: null,
			version: 1,
			createdAt: "2026-01-01T00:00:02.000Z",
		})
		expect(added.postings).toEqual([
			{
				txId: added.tx.id,
				ordinal: 0,
				accountId: food,
				amount: 12050,
				currency: "THB",
				dimensions: { city: "bkk", project: "x" },
			},
			{
				txId: added.tx.id,
				ordinal: 1,
				accountId: cash,
				amount: -12050,
				currency: "THB",
				dimensions: null,
			},
		])
		expect(must(store.listTransactions({ sort: "date" }))).toEqual([added.tx])
		expect(must(store.listPostings({ sort: "tx_id" }))).toEqual(added.postings)
	})

	it("rejects an unbalanced transaction with the core's code at exit 3 and writes nothing", () => {
		const { store, cash, food } = setup()
		const input = lunch(cash, food)
		const body = rejection(
			store.addTransaction({
				...input,
				postings: [input.postings[0]!, { accountId: cash, amount: -1, currency: "THB" }],
			}),
		)
		expect(body).toMatchObject({ code: "UNBALANCED_TRANSACTION", exitCode: 3, path: "postings" })
		expect(counts(store)).toEqual([0, 0])
	})

	it("rewrites the core's bracket paths into dot paths", () => {
		const { store, cash, food } = setup()
		const input = lunch(cash, food)
		const zero = { accountId: cash, amount: 0, currency: "THB" }
		const body = rejection(store.addTransaction({ ...input, postings: [input.postings[0]!, zero] }))
		expect(body).toMatchObject({ code: "ZERO_AMOUNT_POSTING", path: "postings.1.amount" })
		expect(body.details).toEqual({
			field: "postings.1.amount",
			value: 0,
			reason: "must not be zero",
		})
	})

	it("rejects a fractional amount instead of rounding it", () => {
		const { store, cash, food } = setup()
		const body = rejection(store.addTransaction(lunch(cash, food, 120.5)))
		expect(body).toMatchObject({ code: "INVALID_AMOUNT", path: "postings.0.amount" })
	})

	it("rejects a posting to an archived account with account_archived", () => {
		const { store, cash, food } = setup()
		must(store.closeAccount(cash))
		const body = rejection(store.addTransaction(lunch(cash, food)))
		expect(body).toMatchObject({
			code: "account_archived",
			exitCode: 3,
			path: "postings.1.accountId",
		})
	})

	it("rejects a tombstoned or unknown account before the core validates anything", () => {
		const { store, cash, food } = setup()
		const gone = must(store.createAccount({ name: "Gone", type: "asset", currency: "THB" })).account
			.id
		must(store.deleteAccount(gone))
		for (const accountId of [gone, "nope"]) {
			// A single posting would be the core's SINGLE_POSTING; the store answers first.
			const one = { date: "2026-03-01", postings: [{ accountId, amount: 1, currency: "THB" }] }
			expect(rejection(store.addTransaction(one))).toMatchObject({
				code: "UNKNOWN_ACCOUNT",
				path: "postings.0.accountId",
			})
		}
		const empty = { date: "2026-03-01", postings: [] }
		expect(rejection(store.addTransaction(empty)).code).toBe("SINGLE_POSTING")
		expect(lunch(cash, food).postings).toHaveLength(2)
	})

	it("still validates a live child of an archived parent, but not the parent itself", () => {
		const { store, cash } = setup()
		const parent = must(store.createAccount({ name: "Living", type: "expense", currency: "THB" }))
			.account.id
		const child = must(
			store.createAccount({ name: "Rent", type: "expense", currency: "THB", parentId: parent }),
		).account.id
		must(store.closeAccount(parent))
		expect(must(store.addTransaction(lunch(cash, child))).status).toBe("added")
		expect(rejection(store.addTransaction(lunch(cash, parent))).code).toBe("account_archived")
	})

	it("keeps a closed account's postings readable and refuses to tombstone it", () => {
		const { store, cash, food } = setup()
		must(store.addTransaction(lunch(cash, food)))
		must(store.closeAccount(food))
		expect(must(store.listPostings({ sort: "tx_id" })).map((p) => p.accountId)).toContain(food)
		expect(must(store.deleteAccount(food)).status).toBe("has_postings")
	})

	it("treats a repeated external_ref with identical content as a duplicate, not a new row", () => {
		const { store, cash, food } = setup()
		const input = { ...lunch(cash, food), externalRef: "bank:2026-03-01:1" }
		const first = must(store.addTransaction(input))
		const again = must(
			store.addTransaction({ ...input, postings: input.postings.map((p) => ({ ...p })) }),
		)
		expect(again).toEqual({ ...first, status: "duplicate" })
		expect(counts(store)).toEqual([1, 2])
	})

	it("rejects a repeated external_ref with different content as external_ref_conflict", () => {
		const { store, cash, food } = setup()
		const input = { ...lunch(cash, food), externalRef: "bank:1" }
		const first = must(store.addTransaction(input))
		for (const changed of [
			{ ...input, memo: "other" },
			{ ...lunch(cash, food, 1), externalRef: "bank:1" },
		]) {
			const body = rejection(store.addTransaction(changed))
			expect(body).toMatchObject({
				code: "external_ref_conflict",
				exitCode: 5,
				path: "externalRef",
			})
			expect(body.details).toEqual({ externalRef: "bank:1", txId: first.tx.id })
		}
	})

	it("links a reversal to an existing transaction and refuses an unknown link", () => {
		const { store, cash, food } = setup()
		const first = must(store.addTransaction(lunch(cash, food)))
		const reversal = {
			...lunch(cash, food, -12050),
			linkedTo: first.tx.id,
			correctionKind: "reversal" as const,
		}
		expect(must(store.addTransaction(reversal)).tx.linkedTo).toBe(first.tx.id)
		const body = rejection(store.addTransaction({ ...reversal, linkedTo: "nope" }))
		expect(body).toMatchObject({ code: "invalid_input", exitCode: 2, path: "linkedTo" })
	})

	it("refuses a linked row that does not say what it is, and a kind on an unlinked row", () => {
		const { store, cash, food } = setup()
		const first = must(store.addTransaction(lunch(cash, food)))
		const linked = { ...lunch(cash, food, -12050), linkedTo: first.tx.id }
		expect(rejection(store.addTransaction(linked))).toMatchObject({
			code: "invalid_input",
			exitCode: 2,
			path: "correctionKind",
		})
		const named = { ...linked, correctionKind: "replacement" as const }
		expect(must(store.addTransaction(named)).tx.correctionKind).toBe("replacement")
		const unlinked = { ...lunch(cash, food), correctionKind: "reversal" as const }
		expect(rejection(store.addTransaction(unlinked))).toMatchObject({
			code: "invalid_input",
			path: "correctionKind",
		})
	})
})
