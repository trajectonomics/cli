import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { join } from "node:path"
import { run } from "./cli"
import { capture } from "./test-support"
import {
	cli,
	csv,
	errorOf,
	HEADER,
	ledgerSize,
	row,
	seeded,
	tempHome,
} from "./tx-import-test-support"

describe("tx import schema, help and listing", () => {
	it("describes its input, union output, flags, examples and error codes", async () => {
		const res = await capture(["schema", "tx", "import", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.name).toBe("tx import")
		expect(data.positionals).toEqual(["file"])
		expect(data.document).toBeUndefined()
		expect(data.input.required).toBeUndefined()
		expect(Object.keys(data.input.properties).sort()).toEqual(["dryRun", "file", "template"])
		expect(JSON.stringify(data.input)).toContain(HEADER)
		expect(data.output.anyOf).toHaveLength(2)
		expect(data.examples.length).toBeGreaterThan(0)
		expect(data.errorCodes).toEqual(
			[
				"INVALID_ACCOUNT_HIERARCHY",
				"INVALID_AMOUNT",
				"CURRENCY_MISMATCH",
				"INVALID_CURRENCY",
				"INVALID_DATE",
				"INVALID_DIMENSION",
				"NEGATIVE_AMOUNT",
				"NON_LEAF_ACCOUNT",
				"UNBALANCED_TRANSACTION",
				"UNKNOWN_ACCOUNT",
				"ZERO_AMOUNT_POSTING",
				"account_archived",
				"database_busy",
				"external_ref_conflict",
				"invalid_input",
				"unsupported_currency",
			].sort(),
		)
	})

	it("never reads stdin when naming neither a file nor --template", async () => {
		let read = false
		const stdin = async () => {
			read = true
			return HEADER
		}
		const out: string[] = []
		const err: string[] = []
		const code = await run(
			["tx", "import", "--json"],
			{ out: (line) => out.push(line), err: (line) => err.push(line) },
			{ TRAJ_HOME: tempHome() },
			undefined,
			stdin,
		)
		expect(code).toBe(2)
		expect(JSON.parse(err.join("\n")).error.path).toBe("file")
		expect(read).toBe(false)
	})

	it("prints one byte-identical template for every data directory", async () => {
		const first = await cli(tempHome())(["tx", "import", "--template"])
		const second = await cli(tempHome())(["tx", "import", "--template", "--json"])
		expect(first.out).toBe(HEADER)
		expect(JSON.parse(second.out)).toBe(HEADER)
	})

	it("is listed and has generated usage", async () => {
		const listed = JSON.parse((await capture(["schema", "--json"])).out)
		expect(listed.commands.map((entry: { name: string }) => entry.name)).toContain("tx import")
		const help = await capture(["help", "tx", "import"])
		expect(help.code).toBe(0)
		expect(help.out).toContain("Usage: traj tx import [options] [file]")
		expect(help.out).toContain("--template")
		expect(help.out).toContain("--dry-run")
	})
})

describe("tx import database_busy", () => {
	it("exits 5 with database_busy and writes nothing while another writer holds the lock", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const file = csv(home, "busy.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "1", "", "b", ""]),
		])
		const holder = new Database(join(home, "traj.db"))
		holder.run("BEGIN IMMEDIATE")
		try {
			const res = await traj(["tx", "import", file, "--json"])
			expect(res.code).toBe(5)
			expect(errorOf(res)).toMatchObject({ code: "database_busy", exitCode: 5 })
		} finally {
			holder.run("ROLLBACK")
			holder.close()
		}
		expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
	}, 15_000)
})

describe("tx import human output", () => {
	it("prints a counts line and lines for each row", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const file = csv(home, "human.csv", [
			HEADER,
			row(["2026-03-01", "Cash", "Food", "1", "", "h", ""]),
		])
		const res = await traj(["tx", "import", file])
		expect(res.code).toBe(0)
		expect(res.out).toContain("counts:")
		expect(res.out).toContain("added: 1")
		expect(res.out).toContain("line: 2")
	})

	it("prints the envelope's code and the line to fix", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		const file = csv(home, "human-bad.csv", [
			HEADER,
			row(["2026-03-01", "Nope", "Food", "1", "", "h", ""]),
		])
		const res = await traj(["tx", "import", file])
		expect(res.code).toBe(3)
		expect(res.err).toContain("UNKNOWN_ACCOUNT")
		expect(res.err).toContain("line 2")
	})
})
