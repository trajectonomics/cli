import { describe, expect, it } from "bun:test"
import { must, mustOpen, tempHome } from "./testing"

describe("getAccount", () => {
	it("resolves a live id first, then a live name, and never a tombstone", () => {
		const store = mustOpen(tempHome())
		const cash = must(store.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
		const aliased = must(
			store.createAccount({ name: cash.account.id, type: "asset", currency: "THB" }),
		)
		const gone = must(store.createAccount({ name: "Gone", type: "asset", currency: "THB" }))
		expect(must(store.getAccount(cash.account.id))?.id).toBe(cash.account.id)
		expect(must(store.getAccount(aliased.account.name))?.id).toBe(cash.account.id)
		expect(must(store.getAccount("Cash"))?.id).toBe(cash.account.id)
		must(store.closeAccount(cash.account.id))
		expect(must(store.getAccount("Cash"))?.archivedAt).not.toBeNull()
		must(store.deleteAccount(gone.account.id))
		expect(store.getAccount("Gone")).toBeNull()
		expect(store.getAccount("Nope")).toBeNull()
	})
})

describe("listChildAccounts", () => {
	it("lists direct non-tombstoned children by name, archived included", () => {
		const store = mustOpen(tempHome())
		const bank = must(store.createAccount({ name: "Bank", type: "asset", currency: "THB" }))
		const savings = must(
			store.createAccount({
				name: "Savings",
				type: "asset",
				currency: "THB",
				parentId: bank.account.id,
			}),
		)
		must(
			store.createAccount({
				name: "Checking",
				type: "asset",
				currency: "THB",
				parentId: bank.account.id,
			}),
		)
		must(
			store.createAccount({
				name: "Brokerage",
				type: "asset",
				currency: "THB",
				parentId: savings.account.id,
			}),
		)
		const gone = must(
			store.createAccount({
				name: "Gone",
				type: "asset",
				currency: "THB",
				parentId: bank.account.id,
			}),
		)
		must(store.deleteAccount(gone.account.id))
		must(store.closeAccount(savings.account.id))

		const children = must(store.listChildAccounts(bank.account.id))
		expect(children.map((row) => row.name)).toEqual(["Checking", "Savings"])
		expect(children.find((row) => row.name === "Savings")?.archivedAt).not.toBeNull()
		expect(must(store.listChildAccounts("nope"))).toEqual([])
	})
})
