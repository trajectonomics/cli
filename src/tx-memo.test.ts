import { describe, expect, it } from "bun:test"
import { capture } from "./test-support"
import { accounts, amend, cli, json, lunch, type Traj, tempHome } from "./tx-test-support"

/** A `tx add` flag write of 10.00 from Cash to Food, with `extra` appended before `--json`. */
function add(traj: Traj, extra: string[]) {
	return traj([
		"tx",
		"add",
		"--from",
		"Cash",
		"--to",
		"Food",
		"--amount",
		"10",
		"--date",
		"2026-03-01",
		...extra,
		"--json",
	])
}

describe("tx memo flag", () => {
	it("writes the memo --memo gives, and tx show reads it back", async () => {
		const traj = cli(tempHome())
		await accounts(traj, [
			["Cash", "asset"],
			["Food", "expense"],
		])
		const res = await add(traj, ["--memo", "lunch"])
		expect(res.code).toBe(0)
		const added = JSON.parse(res.out)
		expect(added.transaction.memo).toBe("lunch")
		const shown = JSON.parse((await traj(["tx", "show", added.transaction.id, "--json"])).out)
		expect(shown.transaction.memo).toBe("lunch")
	})

	it("makes the memo part of what an external ref replays as a duplicate", async () => {
		const traj = cli(tempHome())
		await accounts(traj, [
			["Cash", "asset"],
			["Food", "expense"],
		])
		const argv = ["--external-ref", "bank:memo", "--memo", "lunch"]
		const first = await add(traj, argv)
		expect(first.code).toBe(0)
		const added = JSON.parse(first.out)
		const again = await add(traj, argv)
		expect(again.code).toBe(0)
		expect(JSON.parse(again.out)).toMatchObject({
			status: "duplicate",
			transaction: { id: added.transaction.id, memo: "lunch" },
		})
		const conflict = await add(traj, ["--external-ref", "bank:memo", "--memo", "dinner"])
		expect(conflict.code).toBe(5)
		expect(JSON.parse(conflict.err).error).toMatchObject({
			code: "external_ref_conflict",
			exitCode: 5,
			details: { externalRef: "bank:memo", txId: added.transaction.id },
		})
	})

	it("writes the memo onto the amend's replacement, and none onto its reversal", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const res = await amend(traj, original.id, ["--memo", "corrected"])
		expect(res.code).toBe(0)
		const data = json(res)
		expect(data.replacement).toMatchObject({ memo: "corrected", linkedTo: original.id })
		expect(data.reversal?.memo).toBeNull()
		expect(data.replacement?.postings.map((p) => p.amount)).toEqual(["100.00", "-100.00"])
	})

	it("lists --memo in the usage and input schema of both flag forms", async () => {
		for (const command of ["add", "amend"]) {
			const help = await capture(["help", "tx", command])
			expect(help.code).toBe(0)
			expect(help.out).toContain("--memo <string>")
			const schema = JSON.parse((await capture(["schema", "tx", command, "--json"])).out)
			expect(schema.input.properties.memo.type).toBe("string")
			expect(schema.input.required).not.toContain("memo")
		}
	})
})
