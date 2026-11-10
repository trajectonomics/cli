import { describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { goldenHome } from "../interchange/testing"
import { tempHome } from "../store/testing"
import { capture } from "../test-support"
import { edgeHome, outPath } from "./testing"

const fixture = () => Bun.file(new URL("fixtures/traj.md", import.meta.url)).text()

async function exportMarkdown(home: string, out = outPath()) {
	const res = await capture(["export", "--format", "md", "--out", out, "--json"], {
		TRAJ_HOME: home,
	})
	if (res.code !== 0) throw new Error(res.err)
	return out
}

describe("export --format md", () => {
	it("writes only traj.md and describes it", async () => {
		const out = await exportMarkdown(await goldenHome())
		expect(existsSync(join(out, "traj.jsonl"))).toBe(false)
		expect(existsSync(join(out, "tx.csv"))).toBe(false)
		const res = await capture(["export", "--format", "md", "--out", outPath(), "--json"], {
			TRAJ_HOME: await goldenHome(),
		})
		const data = JSON.parse(res.out)
		expect(data.format).toBe("md")
		expect(data.files).toEqual(["traj.md"])
		expect(data.rows).toEqual({ entity: 1, account: 7, tx: 4, posting: 8, scenario: 3 })
	})

	it("writes the golden fixture byte for byte, Thai text intact", async () => {
		const out = await exportMarkdown(await goldenHome())
		const text = await Bun.file(join(out, "traj.md")).text()
		expect(text).toBe(await fixture())
		expect(text).toContain("ธนาคารกสิกร")
		expect(text).toContain("ทางเลือก")
	})

	it("puts one section per table, in record order, with the count in the heading", async () => {
		const out = await exportMarkdown(await goldenHome())
		const text = await Bun.file(join(out, "traj.md")).text()
		const headings = text.split("\n").filter((line) => line.startsWith("## "))
		expect(headings).toEqual([
			"## entity (1 row)",
			"## account (7 rows)",
			"## tx (4 rows)",
			"## posting (8 rows)",
			"## scenario (3 rows)",
		])
	})

	it("right-aligns version, ordinal and amount in the separator row", async () => {
		const out = await exportMarkdown(await goldenHome())
		const text = await Bun.file(join(out, "traj.md")).text()
		const posting = text.slice(text.indexOf("## posting"))
		const separator = posting.split("\n")[3]
		expect(separator).toBe("| --- | ---: | --- | ---: | --- | --- |")
		const scenario = text.slice(text.indexOf("## scenario"))
		expect(scenario.split("\n")[3]).toContain("| --- | --- | --- | --- | --- | --- | ---: |")
	})

	it("escapes a pipe, a backslash, angle brackets, an ampersand and a newline", async () => {
		const out = await exportMarkdown(await edgeHome())
		const text = await Bun.file(join(out, "traj.md")).text()
		expect(text).toContain("pipe \\| back\\\\slash &lt;tag&gt; &amp; amp")
		expect(text).toContain('comma, quote " and<br>newline')
		// No raw pipe, angle bracket or newline from the memo reached the table.
		expect(text).not.toContain("pipe | back")
		expect(text).not.toContain("<tag>")
	})

	it("writes an empty table as a heading, a header and a separator", async () => {
		const out = await exportMarkdown(tempHome())
		const text = await Bun.file(join(out, "traj.md")).text()
		const section = text.slice(text.indexOf("## account"), text.indexOf("## tx"))
		const lines = section.split("\n").filter((line) => line !== "")
		expect(lines).toHaveLength(3)
		expect(lines[0]).toBe("## account (0 rows)")
		expect(lines[2]?.startsWith("| --- |")).toBe(true)
		expect(lines[2]?.endsWith("|")).toBe(true)
	})

	it("writes no timestamp and the same bytes twice", async () => {
		const first = await exportMarkdown(await goldenHome())
		const second = await exportMarkdown(await goldenHome())
		const [a, b] = await Promise.all([
			Bun.file(join(first, "traj.md")).text(),
			Bun.file(join(second, "traj.md")).text(),
		])
		expect(b).toBe(a)
		expect(a).not.toMatch(/\d{4}-\d{2}-\d{2}T.*(exported|generated)/i)
	})
})
