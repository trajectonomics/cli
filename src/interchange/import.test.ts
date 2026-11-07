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
})
