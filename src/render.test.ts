import { describe, expect, it } from "bun:test"
import { renderResult } from "./render"
import type { RenderHint } from "./table"

const hint: RenderHint = {
	tables: "tables",
	rows: "rows",
	columns: {
		thing: [
			{ key: "id", label: "id" },
			{ key: "name", label: "name" },
			{ key: "version", label: "version", align: "right" },
		],
	},
}

function result(rows: unknown[], count = rows.length) {
	return { tables: [{ name: "thing", count, rows }] }
}

const hinted: RenderHint = { ...hint, note: "notes" }

describe("the human table hint's note", () => {
	it("prints the named field's sentences under the tables, one per line", () => {
		const data = {
			...result([{ id: "a", name: "cash", version: 1 }]),
			notes: ["No tax is applied.", "Second sentence."],
		}
		expect(renderResult(data, "human", hinted)).toBe(
			[
				"thing (1 row)",
				"id  name  version",
				"a   cash        1",
				"",
				"No tax is applied.",
				"Second sentence.",
			].join("\n"),
		)
	})

	it("prints no note when the result has none, and JSON ignores the hint", () => {
		const data = result([{ id: "a", name: "cash", version: 1 }])
		expect(renderResult(data, "human", hinted)).not.toContain("\n\n\n")
		expect(renderResult(data, "human", hinted)).not.toContain("No tax")
		expect(renderResult({ ...data, notes: ["x"] }, "json", hinted)).toContain('"notes":["x"]')
	})
})

describe("the human table hint", () => {
	it("renders an aligned table under a heading naming the table and its row count", () => {
		const data = result([
			{ id: "a", name: "cash", version: 1 },
			{ id: "bb", name: "food", version: 22 },
		])
		expect(renderResult(data, "human", hint)).toBe(
			["thing (2 rows)", "id  name  version", "a   cash        1", "bb  food       22"].join("\n"),
		)
	})

	it("counts display columns, so Thai combining marks do not skew the padding", () => {
		// "ก่" is two code units but one display column; "ab" is two of each.
		const data = result([
			{ id: "1", name: "ก่", version: 1 },
			{ id: "22", name: "ab", version: 2 },
		])
		const lines = renderResult(data, "human", hint).split("\n")
		const widths = new Set(lines.slice(1).map((line) => Bun.stringWidth(line)))
		expect([...widths]).toEqual([Bun.stringWidth("id  name  version")])
		expect(lines[2]).toContain("ก่")
	})

	it("shows null and an empty string as the same empty cell, and keeps JSON distinct", () => {
		const data = result([
			{ id: "a", name: null, version: 1 },
			{ id: "b", name: "", version: 2 },
		])
		const [heading, header, first, second] = renderResult(data, "human", hint).split("\n")
		expect(heading).toBe("thing (2 rows)")
		expect(header).toBe("id  name  version")
		expect(first?.trimEnd()).toBe("a               1")
		expect(second?.trimEnd()).toBe("b               2")
		expect(renderResult(data, "json", hint)).toBe(JSON.stringify(data))
	})

	it("escapes a backslash and every control character, so a cell cannot break the row", () => {
		const data = result([{ id: "a", name: "line\nbreak\ttab\\end\u001b[31m", version: 1 }])
		const text = renderResult(data, "human", hint)
		expect(text).toContain("line\\nbreak\\ttab\\\\end\\u001b[31m")
		expect(text.split("\n")).toHaveLength(3)
	})

	it("does not truncate a wide value", () => {
		const long = "x".repeat(200)
		expect(renderResult(result([{ id: "a", name: long, version: 1 }]), "human", hint)).toContain(
			long,
		)
	})

	it("prints an empty table as its heading and header", () => {
		expect(renderResult(result([]), "human", hint)).toBe("thing (0 rows)\nid  name  version")
	})

	it("falls back to the generic renderer when an entry has no rows", () => {
		const summary = { tables: [{ name: "thing", count: 2 }] }
		const text = renderResult(summary, "human", hint)
		expect(text).toContain("tables:")
		expect(text).toContain("count: 2")
	})

	it("separates two tables with one blank line", () => {
		const data = {
			tables: [
				{ name: "thing", count: 1, rows: [{ id: "a", name: "cash", version: 1 }] },
				{ name: "thing", count: 1, rows: [{ id: "b", name: "food", version: 2 }] },
			],
		}
		expect(renderResult(data, "human", hint).split("\n\n")).toHaveLength(2)
	})
})
