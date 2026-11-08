import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { PERSONAL_ENTITY_ID } from "./ids"
import { mustOpen, tempHome } from "./testing"
import type { AccountRow, EntityRow, RestoreRows } from "./types"

const AT = "2026-01-01T00:00:00.000Z"
const ENTITY: EntityRow = {
	id: PERSONAL_ENTITY_ID,
	name: "Personal",
	version: 1,
	createdAt: AT,
	updatedAt: AT,
	deletedAt: null,
}
const ACCOUNT: AccountRow = {
	id: "0194a000-0001-7000-8000-000000000001",
	entityId: PERSONAL_ENTITY_ID,
	name: "Cash",
	type: "asset",
	currency: "THB",
	parentId: null,
	archivedAt: null,
	version: 1,
	createdAt: AT,
	updatedAt: AT,
	deletedAt: null,
}
const ROWS: RestoreRows = {
	entity: [ENTITY],
	account: [ACCOUNT],
	tx: [],
	posting: [],
	scenario: [],
}

function refusedBody(rows: RestoreRows) {
	const store = mustOpen(tempHome())
	const outcome = store.restore(rows)
	if (!isAppError(outcome)) throw new Error("the restore was accepted")
	expect(store.listAccounts({ sort: "id", includeDeleted: true })).toEqual([])
	return outcome.body
}

describe("restore", () => {
	it("restores exactly one personal entity and its rows", () => {
		const store = mustOpen(tempHome())
		expect(store.restore(ROWS)).toEqual({ entity: 1, account: 1, tx: 0, posting: 0, scenario: 0 })
	})

	it("refuses anything but exactly one entity, the personal one", () => {
		const other = { ...ENTITY, id: "0194d000-0001-7000-8000-000000000001" }
		for (const entity of [[], [ENTITY, ENTITY], [other], [ENTITY, other]]) {
			expect(refusedBody({ ...ROWS, entity })).toMatchObject({
				code: "invalid_input",
				path: "entity",
			})
		}
	})

	it("refuses a row owned by another entity", () => {
		const account = [{ ...ACCOUNT, entityId: "other" }]
		expect(refusedBody({ ...ROWS, account })).toMatchObject({
			code: "invalid_input",
			path: "account.0.entityId",
		})
	})
	it("refuses a currency other than THB (ADR-0005)", () => {
		const account = [{ ...ACCOUNT, currency: "USD" }]
		expect(refusedBody({ ...ROWS, account })).toMatchObject({
			code: "unsupported_currency",
			exitCode: 3,
			path: "account.0.currency",
			message: "account.0.currency: v1 supports THB only, not USD",
		})
		const unknown = [{ ...ACCOUNT, currency: "ZZZ" }]
		expect(refusedBody({ ...ROWS, account: unknown })).toMatchObject({ code: "INVALID_CURRENCY" })
	})
})
