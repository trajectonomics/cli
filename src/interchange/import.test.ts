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
