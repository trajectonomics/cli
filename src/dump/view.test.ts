import { describe, expect, it } from "bun:test"
import { goldenStore } from "../interchange/testing"
import type { RestoreRows } from "../store"
import { must } from "../store/testing"
import { DUMP_TABLES, viewDump } from "./view"

async function goldenView() {
	const store = await goldenStore()
	return viewDump(must(store.dump()))
}

describe("the dump row view", () => {
	it("shows a posting's amount as the currency's decimal string, never minor units", async () => {
		const view = await goldenView()
		expect(view.posting.map((row) => row.amount)).toEqual([
			"90071992547409.91",
			"-90071992547409.91",
			"50000.00",
			"-50000.00",
			"-125.50",
			"125.50",
			"125.50",
			"-125.50",
		])
		// The currency travels beside the amount, so a reader never has to guess the scale.
		expect(view.posting.map((row) => row.currency)).toEqual(view.posting.map(() => "THB"))
	})

	it("keeps a Scenario document as its stored canonical text, never re-parsed", async () => {
		const view = await goldenView()
		expect(view.scenario.map((row) => row.document)).toEqual([
			'{"accounts":[{"id":"savings","kind":"asset","rate":275},{"id":"mortgage","kind":"liability","rate":500}],"cashflow":{"contribute":[],"surplus":[{"account":"savings"}],"withdraw":["savings"]},"currency":"THB","economy":{"inflation":300},"flows":[{"amount":5500000,"earned":true,"frequency":"monthly","growth":"inflation","id":"salary","kind":"income","start":"2026-01-01"}],"schemaVersion":4}',
			'{"accounts":[{"id":"savings","kind":"asset","rate":250},{"id":"mortgage","kind":"liability","rate":500}],"cashflow":{"contribute":[],"surplus":[{"account":"savings"}],"withdraw":["savings"]},"currency":"THB","economy":{"inflation":300},"flows":[{"amount":5000000,"earned":true,"frequency":"monthly","growth":"inflation","id":"salary","kind":"income","start":"2026-01-01"}],"schemaVersion":4}',
			'{"accounts":[{"id":"draft-cash","kind":"asset","rate":125}],"cashflow":{"contribute":[],"surplus":[{"account":"draft-cash"}],"withdraw":["draft-cash"]},"currency":"THB","economy":{"inflation":0},"flows":[{"amount":1,"earned":true,"frequency":"monthly","growth":"inflation","id":"draft-salary","kind":"income","start":"2026-01-01"}],"schemaVersion":4}',
		])
	})

	it("keeps dimensions as an object, or null when the posting has none", async () => {
		const view = await goldenView()
		expect(view.posting.map((row) => row.dimensions)).toEqual([
			null,
			null,
			{ channel: "transfer", project: "ร้านกาแฟ" },
			null,
			null,
			null,
			{ project: "ร้านกาแฟ" },
			null,
		])
	})

	it("carries every synced column and every tombstone verbatim", async () => {
		const view = await goldenView()
		const typo = view.account.find((row) => row.name === "Typo account")
		expect(typo).toEqual({
			id: "0194a000-0005-7000-8000-000000000005",
			entityId: "00000000-0000-7000-8000-000000000001",
			name: "Typo account",
			type: "expense",
			currency: "THB",
			parentId: null,
			archivedAt: null,
			version: 2,
			createdAt: "2026-01-01T09:00:05.005Z",
			updatedAt: "2026-01-02T10:00:00.500Z",
			deletedAt: "2026-01-02T10:00:00.500Z",
		})
	})

	it("lists the tables in the canonical record order", () => {
		expect(DUMP_TABLES).toEqual(["entity", "account", "tx", "posting", "scenario"])
	})

	it("does not change a null into an empty string", () => {
		const rows: RestoreRows = {
			entity: [],
			account: [],
			tx: [
				{
					id: "tx-1",
					entityId: "e",
					date: "2026-01-01",
					memo: null,
					linkedTo: null,
					externalRef: null,
					version: 1,
					createdAt: "2026-01-01T00:00:00.000Z",
					updatedAt: "2026-01-01T00:00:00.000Z",
					correctionKind: null,
				},
				{
					id: "tx-2",
					entityId: "e",
					date: "2026-01-01",
					memo: "",
					linkedTo: null,
					externalRef: null,
					version: 1,
					createdAt: "2026-01-01T00:00:00.000Z",
					updatedAt: "2026-01-01T00:00:00.000Z",
					correctionKind: null,
				},
			],
			posting: [],
			scenario: [],
		}
		expect(viewDump(rows).tx.map((row) => row.memo)).toEqual([null, ""])
	})
})
