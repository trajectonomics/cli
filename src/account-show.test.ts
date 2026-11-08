import { describe, expect, it } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { capture } from "./test-support"

function tempHome(): string {
	return join(mkdtempSync(join(tmpdir(), "traj-account-")), "home")
}

function cli(home: string) {
	return (argv: string[]) => capture(argv, { TRAJ_HOME: home })
}

async function add(
	traj: (argv: string[]) => Promise<{ code: number; out: string; err: string }>,
	name: string,
	parent?: string,
) {
	const res = await traj([
		"account",
		"add",
		name,
		"--type",
		"asset",
		"--currency",
		"THB",
		...(parent === undefined ? [] : ["--parent", parent]),
		"--json",
	])
	expect(res.code).toBe(0)
	return JSON.parse(res.out).account
}

describe("account show", () => {
	it("returns the same account when addressed by name and by id", async () => {
		const traj = cli(tempHome())
		const added = await add(traj, "Cash")
		const byName = await traj(["account", "show", "Cash", "--json"])
		const byId = await traj(["account", "show", added.id, "--json"])
		expect(byName.code).toBe(0)
		expect(byId.code).toBe(0)
		expect(JSON.parse(byName.out).account).toEqual(added)
		expect(JSON.parse(byId.out).account).toEqual(added)
	})

	it("reports an unknown account as not_found", async () => {
		const traj = cli(tempHome())
		const res = await traj(["account", "show", "Nope", "--json"])
		expect(res.code).toBe(4)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "not_found",
			exitCode: 4,
			details: { resource: "account" },
		})
	})

	it("lists a child's parent by name", async () => {
		const traj = cli(tempHome())
		const bank = await add(traj, "Bank")
		const savings = await add(traj, "Savings", "Bank")
		const shown = JSON.parse((await traj(["account", "show", "Savings", "--json"])).out)
		expect(shown.parent).toEqual({ id: bank.id, name: "Bank" })
		expect(shown.children).toEqual([])
		expect(shown.account.parentId).toBe(bank.id)
		expect(shown.account.id).toBe(savings.id)
	})

	it("lists a parent's direct children by name and no grandchild", async () => {
		const traj = cli(tempHome())
		const bank = await add(traj, "Bank")
		const savings = await add(traj, "Savings", "Bank")
		const checking = await add(traj, "Checking", "Bank")
		await add(traj, "Brokerage", "Savings")
		const shown = JSON.parse((await traj(["account", "show", "Bank", "--json"])).out)
		expect(shown.parent).toBeNull()
		expect(shown.children).toEqual([
			{ id: checking.id, name: "Checking" },
			{ id: savings.id, name: "Savings" },
		])
		expect(shown.account.id).toBe(bank.id)
	})

	it("has no balances: the result is the row, its parent and its children only", async () => {
		const traj = cli(tempHome())
		await add(traj, "Bank")
		const shown = JSON.parse((await traj(["account", "show", "Bank", "--json"])).out)
		expect(Object.keys(shown).sort()).toEqual(["account", "children", "parent"])
	})
})
