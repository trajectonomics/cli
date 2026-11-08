import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { PERSONAL_ENTITY_ID } from "./ids"
import { must, mustOpen, tempHome } from "./testing"

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe("accounts", () => {
	it("creates an account as a sync-ready row owned by the personal entity", () => {
		const store = mustOpen(tempHome())
		const made = must(store.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
		expect(made.status).toBe("created")
		expect(made.account).toMatchObject({
			entityId: PERSONAL_ENTITY_ID,
			name: "Cash",
			type: "asset",
			currency: "THB",
			parentId: null,
			archivedAt: null,
			version: 1,
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			deletedAt: null,
		})
		expect(made.account.id).toMatch(UUID_V7)
		expect(must(store.listAccounts({ sort: "name" }))).toEqual([made.account])
	})

	it("lists in the order asked for, not insertion order", () => {
		const store = mustOpen(tempHome())
		for (const name of ["Salary", "Cash", "Opening"]) {
			must(store.createAccount({ name, type: "asset", currency: "THB" }))
		}
		const names = must(store.listAccounts({ sort: "name" })).map((a) => a.name)
		expect(names).toEqual(["Cash", "Opening", "Salary"])
		const byCreation = must(store.listAccounts({ sort: "created_at" })).map((a) => a.name)
		expect(byCreation).toEqual(["Salary", "Cash", "Opening"])
	})

	it("refuses a second live account with the same name in one entity", () => {
		const store = mustOpen(tempHome())
		const first = must(store.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
		const second = must(store.createAccount({ name: "Cash", type: "expense", currency: "THB" }))
		expect(second).toEqual({ status: "name_taken", account: first.account })
		expect(must(store.listAccounts({ sort: "id" }))).toHaveLength(1)
	})

	it("frees a tombstoned account's name for reuse and keeps the tombstone for export", () => {
		const store = mustOpen(tempHome())
		const first = must(store.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
		const deleted = must(store.deleteAccount(first.account.id))
		expect(deleted.status).toBe("deleted")
		if (deleted.status !== "deleted") return
		expect(deleted.account.version).toBe(2)
		expect(deleted.account.deletedAt).toBe("2026-01-01T00:00:01.000Z")
		const again = must(store.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
		expect(again.status).toBe("created")
		expect(must(store.listAccounts({ sort: "id" })).map((a) => a.id)).toEqual([again.account.id])
		const all = must(store.listAccounts({ sort: "created_at", includeDeleted: true }))
		expect(all.map((a) => a.id)).toEqual([first.account.id, again.account.id])
	})

	it("closes an account by archiving it and bumping its version", () => {
		const store = mustOpen(tempHome())
		const { account } = must(store.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
		const closed = must(store.closeAccount(account.id))
		expect(closed).toEqual({
			status: "archived",
			account: {
				...account,
				archivedAt: "2026-01-01T00:00:01.000Z",
				version: 2,
				updatedAt: "2026-01-01T00:00:01.000Z",
			},
		})
		const again = must(store.closeAccount(account.id))
		expect(again.status).toBe("already_archived")
		expect(must(store.closeAccount("nope"))).toEqual({ status: "not_found" })
	})

	it("refuses to tombstone a parent that still has live children", () => {
		const store = mustOpen(tempHome())
		const parent = must(store.createAccount({ name: "Bank", type: "asset", currency: "THB" }))
		const id = parent.account.id
		must(store.createAccount({ name: "Savings", type: "asset", currency: "THB", parentId: id }))
		expect(must(store.deleteAccount(id)).status).toBe("has_children")
		expect(must(store.deleteAccount("nope"))).toEqual({ status: "not_found" })
	})

	it("validates a new account through the core's chart of accounts", () => {
		const store = mustOpen(tempHome())
		const bad = store.createAccount({ name: "X", type: "asset", currency: "THB", parentId: "nope" })
		if (!isAppError(bad)) throw new Error("expected a hierarchy error")
		expect(bad.body.code).toBe("INVALID_ACCOUNT_HIERARCHY")
		expect(bad.body.exitCode).toBe(3)
		const money = store.createAccount({ name: "Y", type: "asset", currency: "ZZZ" })
		expect(isAppError(money) && money.body.code).toBe("INVALID_CURRENCY")
	})

	it("points a rejection of the new account at the caller's own field", () => {
		const store = mustOpen(tempHome())
		must(store.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
		const money = store.createAccount({ name: "Y", type: "asset", currency: "thb" })
		expect(isAppError(money) && money.body).toMatchObject({
			code: "INVALID_CURRENCY",
			path: "currency",
		})
		const kind = store.createAccount({ name: "Z", type: "cash" as "asset", currency: "THB" })
		expect(isAppError(kind) && kind.body).toMatchObject({ code: "invalid_input", path: "type" })
	})
	it("accepts THB only in v1 (ADR-0005), after the core accepts the code", () => {
		const store = mustOpen(tempHome())
		const usd = store.createAccount({ name: "Dollars", type: "asset", currency: "USD" })
		expect(isAppError(usd) && usd.body).toMatchObject({
			code: "invalid_input",
			exitCode: 2,
			path: "currency",
			message: "currency: v1 supports THB only, not USD",
		})
		expect(must(store.listAccounts({ sort: "id" }))).toEqual([])
	})
})
