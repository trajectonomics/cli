import { describe, expect, it } from "bun:test"
import { capture } from "./test-support"

describe("schema tx add", () => {
	it("prints the flag form and the document form as the two accepted shapes", async () => {
		const res = await capture(["schema", "tx", "add", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.input.required.sort()).toEqual(["amount", "date", "from", "to"])
		expect(data.document.flag).toBe("postings")
		expect(data.document.schema.required.sort()).toEqual(["date", "postings"])
		expect(data.document.schema.properties.postings.type).toBe("array")
		expect(data.document.schema.properties.postings.items.properties.amount.type).toBe("string")
	})

	it("shows both usage forms in help", async () => {
		const res = await capture(["help", "tx", "add"])
		expect(res.code).toBe(0)
		const usages = res.out.split("\n").filter((line) => line.startsWith("Usage:"))
		expect(usages).toHaveLength(2)
		expect(usages[1]).toContain("--postings <file|->")
	})
})
