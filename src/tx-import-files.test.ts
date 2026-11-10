import { describe, expect, it } from "bun:test"
import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import {
	cli,
	csv,
	errorOf,
	HEADER,
	imported,
	ledgerSize,
	row,
	seeded,
	tempHome,
} from "./tx-import-test-support"

describe("tx import file-level failures", () => {
	it("rejects an unreadable path at file and writes nothing", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const res = await traj(["tx", "import", join(dirname(home), "missing.csv"), "--json"])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", exitCode: 2, path: "file" })
		expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
	})

	it("rejects invalid UTF-8 rather than storing a corrupted memo", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const path = join(dirname(home), "latin1.csv")
		writeFileSync(path, Buffer.from(`${HEADER}\n2026-03-01,Cash,Food,1,caf\xe9,ref,\n`, "latin1"))
		const res = await traj(["tx", "import", path, "--json"])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", exitCode: 2, path: "file" })
		expect(errorOf(res).message).toContain("UTF-8")
	})

	it("rejects an empty, whitespace-only or BOM-only file", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		for (const [name, text] of [
			["empty", ""],
			["space", "  \n\t\n"],
			["bom", "\uFEFF"],
		] as const) {
			const res = await traj(["tx", "import", csv(home, `${name}.csv`, [text]), "--json"])
			expect(res.code).toBe(2)
			expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "file" })
		}
	})

	it("rejects a wrong header at header with the expected and actual text", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const res = await traj([
			"tx",
			"import",
			csv(home, "header.csv", ["date;from;to;amount;memo;external_ref;project"]),
			"--json",
		])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({
			code: "invalid_input",
			path: "header",
			details: {
				expected: HEADER,
				actual: "date;from;to;amount;memo;external_ref;project",
			},
		})
	})

	it("rejects a short row, a long row and an unclosed quote at their physical line", async () => {
		const cases = [
			{ lines: [HEADER, "2026-03-01,Cash"], path: "line.2" },
			{
				lines: [HEADER, `${row(["2026-03-01", "Cash", "Food", "1", "", "r", ""])},extra`],
				path: "line.2",
			},
			{
				lines: [HEADER, "", row(["2026-03-01", "Cash", "Food", "1", '"open', "r", ""])],
				path: "line.3",
			},
		]
		for (const entry of cases) {
			const home = tempHome()
			const traj = cli(home)
			await seeded(traj)
			const res = await traj(["tx", "import", csv(home, "bad.csv", entry.lines), "--json"])
			expect(res.code).toBe(2)
			expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: entry.path })
			expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
		}
	})
})

describe("tx import stdin", () => {
	it("reads the CSV from - and accepts a BOM and CRLF", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const text = `\uFEFF${HEADER}\r\n2026-03-01,Cash,Food,10,Lunch,stdin:1,\r\n`
		const res = await cli(home, text)(["tx", "import", "-", "--json"])
		expect(res.code).toBe(0)
		expect(imported(res).rows[0]?.transaction).toMatchObject({
			memo: "Lunch",
			externalRef: "stdin:1",
		})
	})

	it("rejects an empty stdin and a stdin holding a replacement character", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const empty = await cli(home, "")(["tx", "import", "-", "--json"])
		expect(empty.code).toBe(2)
		expect(errorOf(empty)).toMatchObject({ code: "invalid_input", path: "file" })
		const broken = await cli(
			home,
			`${HEADER}\n2026-03-01,Cash,Food,1,a\uFFFDb,r,\n`,
		)(["tx", "import", "-", "--json"])
		expect(broken.code).toBe(2)
		expect(errorOf(broken)).toMatchObject({ code: "invalid_input", path: "file" })
		expect(errorOf(broken).message).toContain("UTF-8")
	})
})
