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

async function seed(traj: (argv: string[]) => Promise<{ code: number; out: string; err: string }>) {
	const res = await traj([
		"account",
		"add",
		"Cash",
		"--type",
		"asset",
		"--currency",
		"THB",
		"--json",
	])
	return JSON.parse(res.out).account
}

describe("account close", () => {
	it("archives by name, and closing again exits 0 as already_archived", async () => {
		const traj = cli(tempHome())
		const account = await seed(traj)
		const first = await traj(["account", "close", "Cash", "--json"])
		expect(first.code).toBe(0)
		const closed = JSON.parse(first.out)
		expect(closed).toMatchObject({ dryRun: false, status: "archived" })
		expect(closed.account).toMatchObject({ id: account.id, version: 2 })
		expect(closed.account.archivedAt).not.toBeNull()

		const again = await traj(["account", "close", account.id, "--json"])
		expect(again.code).toBe(0)
		expect(JSON.parse(again.out)).toMatchObject({
			dryRun: false,
			status: "already_archived",
			account: { id: account.id, version: 2, archivedAt: closed.account.archivedAt },
		})
	})

	it("keeps an archived account in the chart and in show", async () => {
		const traj = cli(tempHome())
		const account = await seed(traj)
		await traj(["account", "close", "Cash", "--json"])
		const listed = JSON.parse((await traj(["account", "list", "--json"])).out).accounts
		expect(listed).toHaveLength(1)
		expect(listed[0].id).toBe(account.id)
		expect(typeof listed[0].archivedAt).toBe("string")
		const shown = await traj(["account", "show", "Cash", "--json"])
		expect(shown.code).toBe(0)
		expect(JSON.parse(shown.out).account.archivedAt).toBe(listed[0].archivedAt)
	})

	it("reports an unknown account as not_found", async () => {
		const traj = cli(tempHome())
		const res = await traj(["account", "close", "Nope", "--json"])
		expect(res.code).toBe(4)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "not_found",
			exitCode: 4,
			details: { resource: "account" },
		})
	})

	it("lists exactly the codes that command raises", async () => {
		const data = JSON.parse((await capture(["schema", "account", "close", "--json"])).out)
		expect(data.errorCodes).toEqual(["database_busy", "not_found"])
	})

	it("returns the row it would archive under --dry-run and writes nothing", async () => {
		const traj = cli(tempHome())
		await seed(traj)
		const res = await traj(["account", "close", "Cash", "--dry-run", "--json"])
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toMatchObject({ dryRun: true, status: "archived" })
		expect(JSON.parse(res.out).account.version).toBe(2)
		const shown = JSON.parse((await traj(["account", "show", "Cash", "--json"])).out)
		expect(shown.account).toMatchObject({ version: 1, archivedAt: null })
	})
})
