import { describe, expect, it } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { must, mustOpen } from "./store/testing"
import { capture } from "./test-support"

function tempHome(): string {
	return join(mkdtempSync(join(tmpdir(), "traj-account-")), "home")
}

function cli(home: string) {
	return (argv: string[]) => capture(argv, { TRAJ_HOME: home })
}

describe("account list", () => {
	it("shows the chart ordered by name", async () => {
		const traj = cli(tempHome())
		for (const name of ["Salary", "Cash", "Opening"]) {
			const res = await traj([
				"account",
				"add",
				name,
				"--type",
				"asset",
				"--currency",
				"THB",
				"--json",
			])
			expect(res.code).toBe(0)
		}
		const res = await traj(["account", "list", "--json"])
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out).accounts.map((a: { name: string }) => a.name)).toEqual([
			"Cash",
			"Opening",
			"Salary",
		])
	})

	it("keeps an archived account in its name's place", async () => {
		const traj = cli(tempHome())
		for (const name of ["Zebra", "Bank", "Cash"]) {
			const res = await traj([
				"account",
				"add",
				name,
				"--type",
				"asset",
				"--currency",
				"THB",
				"--json",
			])
			expect(res.code).toBe(0)
		}
		expect((await traj(["account", "close", "Bank", "--json"])).code).toBe(0)
		const listed = JSON.parse((await traj(["account", "list", "--json"])).out).accounts
		expect(listed.map((a: { name: string }) => a.name)).toEqual(["Bank", "Cash", "Zebra"])
		expect(typeof listed[0].archivedAt).toBe("string")
	})

	it("never lists a tombstoned account", async () => {
		const home = tempHome()
		const store = mustOpen(home)
		const kept = must(store.createAccount({ name: "Kept", type: "asset", currency: "THB" }))
		const gone = must(store.createAccount({ name: "Gone", type: "asset", currency: "THB" }))
		expect(must(store.deleteAccount(gone.account.id)).status).toBe("deleted")
		store.close()

		const listed = JSON.parse((await cli(home)(["account", "list", "--json"])).out).accounts
		expect(listed.map((a: { id: string }) => a.id)).toEqual([kept.account.id])
	})
})
