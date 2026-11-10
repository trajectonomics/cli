import { describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { DUMP_TABLES } from "../dump/view"
import { FIELDS } from "../interchange/format"
import { goldenHome } from "../interchange/testing"
import { tempHome } from "../store/testing"
import { capture } from "../test-support"
import { edgeHome, outPath, parseCsv } from "./testing"

const fixture = (name: string) => Bun.file(new URL(`fixtures/${name}`, import.meta.url)).bytes()

const BOM = [0xef, 0xbb, 0xbf]

async function exportCsv(home: string, out = outPath()) {
	const res = await capture(["export", "--format", "csv", "--out", out, "--json"], {
		TRAJ_HOME: home,
	})
	if (res.code !== 0) throw new Error(res.err)
	return out
}

describe("export --format csv", () => {
	it("writes one file per table, named for the table, in record order", async () => {
		const out = await exportCsv(await goldenHome())
		expect(existsSync(join(out, "traj.jsonl"))).toBe(false)
		expect(existsSync(join(out, "traj.md"))).toBe(false)
		for (const table of DUMP_TABLES) expect(existsSync(join(out, `${table}.csv`))).toBe(true)
		const res = await capture(["export", "--format", "csv", "--out", outPath(), "--json"], {
			TRAJ_HOME: await goldenHome(),
		})
		const data = JSON.parse(res.out)
		expect(data.format).toBe("csv")
		expect(data.files).toEqual(DUMP_TABLES.map((table) => `${table}.csv`))
		expect(data.rows).toEqual({ entity: 1, account: 7, tx: 4, posting: 8, scenario: 3 })
	})

	it("starts with the UTF-8 BOM, ends every line in CRLF, and heads with the row's keys", async () => {
		const out = await exportCsv(await goldenHome())
		for (const table of DUMP_TABLES) {
			const raw = await Bun.file(join(out, `${table}.csv`)).bytes()
			expect([...raw.slice(0, 3)]).toEqual(BOM)
			// Bun strips a leading BOM when decoding, so read the bytes after it explicitly.
			const text = new TextDecoder().decode(raw.slice(3))
			expect(text.endsWith("\r\n")).toBe(true)
			const lines = text.split("\r\n").slice(0, -1)
			expect(lines.every((line) => !line.includes("\n") && !line.includes("\r"))).toBe(true)
			expect(lines[0]).toBe(Object.keys(FIELDS[table]).join(","))
		}
	})

	it("writes the golden fixture byte for byte", async () => {
		const out = await exportCsv(await goldenHome())
		for (const table of DUMP_TABLES) {
			const actual = await Bun.file(join(out, `${table}.csv`)).bytes()
			expect({ table, bytes: [...actual] }).toEqual({
				table,
				bytes: [...(await fixture(`csv/${table}.csv`))],
			})
		}
	})

	it("keeps Thai text intact", async () => {
		const out = await exportCsv(await goldenHome())
		const accounts = await Bun.file(join(out, "account.csv")).text()
		const postings = await Bun.file(join(out, "posting.csv")).text()
		expect(accounts).toContain("ธนาคารกสิกร")
		expect(postings).toContain("ร้านกาแฟ")
	})

	it("round-trips a comma, a quote and a newline through an RFC 4180 reader", async () => {
		const out = await exportCsv(await edgeHome())
		const raw = await Bun.file(join(out, "tx.csv")).bytes()
		const text = new TextDecoder().decode(raw.slice(3))
		expect(text).toContain('"comma, quote "" and\nnewline"')
		const rows = parseCsv(text)
		const header = rows[0] ?? []
		expect(header).toEqual(Object.keys(FIELDS.tx))
		const memos = rows.slice(1).map((row) => row[header.indexOf("memo")])
		expect(memos).toContain('comma, quote " and\nnewline')
		expect(memos).toContain("pipe | back\\slash <tag> & amp")
	})

	it("shows a null and an empty string as the same empty cell", async () => {
		const out = await exportCsv(await edgeHome())
		const raw = await Bun.file(join(out, "tx.csv")).bytes()
		const rows = parseCsv(new TextDecoder().decode(raw.slice(3)))
		const memo = rows[0]?.indexOf("memo") ?? -1
		// edge:3 stored an empty memo, edge:4 stored none: both are an empty cell.
		expect(rows.slice(1).map((row) => row[memo])).toEqual([
			'comma, quote " and\nnewline',
			"pipe | back\\slash <tag> & amp",
			"",
			"",
		])
	})

	it("writes an empty table as its header only", async () => {
		const out = await exportCsv(tempHome())
		const text = await Bun.file(join(out, "account.csv")).text()
		expect(text.replace(/^\uFEFF/, "")).toBe(`${Object.keys(FIELDS.account).join(",")}\r\n`)
		const entity = await Bun.file(join(out, "entity.csv")).text()
		expect(entity).toContain("Personal")
	})

	it("writes the same bytes twice", async () => {
		const first = await exportCsv(await goldenHome())
		const second = await exportCsv(await goldenHome())
		for (const table of DUMP_TABLES) {
			const [a, b] = await Promise.all([
				Bun.file(join(first, `${table}.csv`)).bytes(),
				Bun.file(join(second, `${table}.csv`)).bytes(),
			])
			expect([...b]).toEqual([...a])
		}
	})
})
