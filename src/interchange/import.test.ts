import { describe, expect, it } from "bun:test"
import { must, mustOpen, tempHome } from "../store/testing"
import { exportJsonl, importJsonl } from "./index"
import { goldenJsonl, goldenStore, tableDump } from "./testing"

describe("importJsonl", () => {
	it("restores the golden export into a fresh database and exports it byte for byte", async () => {
		const golden = await goldenJsonl()
		const restored = mustOpen(tempHome())
		expect(must(importJsonl(golden, restored))).toEqual({
			entity: 1,
			account: 7,
			tx: 4,
			posting: 8,
			scenario: 3,
		})
		expect(must(exportJsonl(restored))).toBe(golden)
	})

	it("restores every column of every table, not only the serialised text", async () => {
		const source = await goldenStore()
		const restored = mustOpen(tempHome())
		must(importJsonl(must(exportJsonl(source)), restored))
		const dump = tableDump(restored)
		expect(dump).toEqual(tableDump(source))
		expect(dump["entity"]).toHaveLength(1)
	})

	it("restores each transaction's correction kind unchanged", () => {
		const source = mustOpen(tempHome())
		const cash = must(source.createAccount({ name: "Cash", type: "asset", currency: "THB" }))
			.account.id
		const food = must(source.createAccount({ name: "Food", type: "expense", currency: "THB" }))
			.account.id
		const original = must(
			source.addTransaction({
				date: "2026-03-01",
				postings: [
					{ accountId: food, amount: 12050, currency: "THB" },
					{ accountId: cash, amount: -12050, currency: "THB" },
				],
			}),
		).tx
		must(
			source.amendTransaction(original.id, {
				replacement: {
					date: "2026-03-02",
					postings: [
						{ accountId: food, amount: 10000, currency: "THB" },
						{ accountId: cash, amount: -10000, currency: "THB" },
					],
				},
			}),
		)
		const restored = mustOpen(tempHome())
		must(importJsonl(must(exportJsonl(source)), restored))
		const kinds = (store: ReturnType<typeof mustOpen>) =>
			must(store.listTransactions({ sort: "date" }))
				.map((tx) => `${tx.date} ${tx.correctionKind}`)
				.sort()
		expect(kinds(restored)).toEqual(kinds(source))
		expect(kinds(restored)).toEqual([
			"2026-03-01 null",
			"2026-03-02 replacement",
			"2026-03-02 reversal",
		])
	})

	it("imports parent, link and fork references that point forward in the file", async () => {
		const golden = await goldenJsonl()
		const lineOf = (id: string) => golden.indexOf(`"id":"${id}"`)
		const assets = "0194a000-0009-7000-8000-000000000009"
		const lunch = "0194b000-0004-7000-8000-000000000004"
		const base = "0194c000-0002-7000-8000-000000000002"
		for (const target of [assets, lunch, base]) {
			expect(golden.indexOf(`"${target}"`)).toBeLessThan(lineOf(target))
		}
		const store = mustOpen(tempHome())
		must(importJsonl(golden, store))
		const accounts = must(store.listAccounts({ sort: "id", includeDeleted: true }))
		expect(accounts[0]).toMatchObject({ name: "ธนาคารกสิกร", parentId: assets })
		const [, , voided] = must(store.listTransactions({ sort: "date" }))
		expect(voided).toMatchObject({ memo: "void", linkedTo: lunch })
		const [fork] = must(store.listScenarios({ sort: "id" }))
		expect(fork).toMatchObject({ name: "ทางเลือก", forkedFrom: base })
	})
})
