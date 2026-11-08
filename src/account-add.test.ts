import { describe, expect, it } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { capture } from "./test-support"

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function tempHome(): string {
	return join(mkdtempSync(join(tmpdir(), "traj-account-")), "home")
}

function cli(home: string) {
	return (argv: string[]) => capture(argv, { TRAJ_HOME: home })
}

async function add(
	traj: (argv: string[]) => Promise<{ code: number; out: string; err: string }>,
	name: string,
	extra: string[] = [],
) {
	return traj(["account", "add", name, "--type", "asset", "--currency", "THB", ...extra, "--json"])
}

describe("account add", () => {
	it("creates an account and reports the row it wrote", async () => {
		const traj = cli(tempHome())
		const res = await add(traj, "Cash")
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.dryRun).toBe(false)
		expect(data.account).toMatchObject({
			name: "Cash",
			type: "asset",
			currency: "THB",
			parentId: null,
			archivedAt: null,
			version: 1,
		})
		expect(data.account.id).toMatch(UUID_V7)
	})

	it("rejects a duplicate name with account_name_taken and the existing account's id", async () => {
		const traj = cli(tempHome())
		const first = JSON.parse((await add(traj, "Cash")).out).account
		const again = await add(traj, "Cash")
		expect(again.code).toBe(5)
		const { error } = JSON.parse(again.err)
		expect(error.code).toBe("account_name_taken")
		expect(error.exitCode).toBe(5)
		expect(error.message).toContain("Cash")
		expect(error.details).toEqual({ accountId: first.id })
	})

	it("rejects a duplicate under --dry-run too, and writes nothing", async () => {
		const traj = cli(tempHome())
		await add(traj, "Cash")
		const again = await add(traj, "Cash", ["--dry-run"])
		expect(again.code).toBe(5)
		expect(JSON.parse(again.err).error.code).toBe("account_name_taken")
		const listed = JSON.parse((await traj(["account", "list", "--json"])).out)
		expect(listed.accounts.map((a: { name: string }) => a.name)).toEqual(["Cash"])
	})

	it("reports a well-formed but unsupported currency as unsupported_currency", async () => {
		const traj = cli(tempHome())
		const res = await traj([
			"account",
			"add",
			"Dollars",
			"--type",
			"asset",
			"--currency",
			"USD",
			"--json",
		])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "unsupported_currency",
			exitCode: 3,
			path: "currency",
		})
	})

	it("keeps a malformed currency as the core's INVALID_CURRENCY", async () => {
		const traj = cli(tempHome())
		const res = await traj([
			"account",
			"add",
			"Fantasy",
			"--type",
			"asset",
			"--currency",
			"XYZ",
			"--json",
		])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "INVALID_CURRENCY",
			exitCode: 3,
			path: "currency",
		})
	})

	it("rejects a name shaped like a UUID as invalid input", async () => {
		const traj = cli(tempHome())
		const res = await add(traj, "0194a000-0002-7000-8000-000000000002")
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "invalid_input",
			exitCode: 2,
			path: "name",
		})
		expect(JSON.parse((await traj(["account", "list", "--json"])).out).accounts).toEqual([])
	})

	it("reports an unknown parent as not_found", async () => {
		const traj = cli(tempHome())
		const res = await add(traj, "Savings", ["--parent", "Nope"])
		expect(res.code).toBe(4)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "not_found",
			exitCode: 4,
			details: { resource: "account" },
		})
	})

	it("rejects a parent of another type with the core's hierarchy code", async () => {
		const traj = cli(tempHome())
		await traj(["account", "add", "Food", "--type", "expense", "--currency", "THB", "--json"])
		const res = await add(traj, "Lunch", ["--parent", "Food"])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "INVALID_ACCOUNT_HIERARCHY",
			exitCode: 3,
		})
	})

	it("treats names as exact and case-sensitive", async () => {
		const traj = cli(tempHome())
		expect((await add(traj, "Cash")).code).toBe(0)
		expect((await add(traj, "cash")).code).toBe(0)
		const listed = JSON.parse((await traj(["account", "list", "--json"])).out).accounts
		expect(listed.map((a: { name: string }) => a.name)).toEqual(["Cash", "cash"])
	})

	it("keeps an archived account's name taken", async () => {
		const traj = cli(tempHome())
		const first = JSON.parse((await add(traj, "Cash")).out).account
		await traj(["account", "close", "Cash", "--json"])
		const again = await add(traj, "Cash")
		expect(again.code).toBe(5)
		expect(JSON.parse(again.err).error).toMatchObject({
			code: "account_name_taken",
			details: { accountId: first.id },
		})
	})
})

describe("account add dry run", () => {
	it("returns the row it would write with a null id and writes nothing", async () => {
		const traj = cli(tempHome())
		const res = await add(traj, "Cash", ["--dry-run"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.dryRun).toBe(true)
		expect(data.account).toMatchObject({
			id: null,
			name: "Cash",
			type: "asset",
			currency: "THB",
			version: 1,
		})
		expect(JSON.parse((await traj(["account", "list", "--json"])).out).accounts).toEqual([])
	})
})

describe("schema account add", () => {
	it("lists exactly the codes that command raises", async () => {
		const data = JSON.parse((await capture(["schema", "account", "add", "--json"])).out)
		expect(data.errorCodes).toEqual([
			"INVALID_ACCOUNT_HIERARCHY",
			"INVALID_CURRENCY",
			"account_name_taken",
			"database_busy",
			"invalid_input",
			"not_found",
			"unsupported_currency",
		])
	})
})
