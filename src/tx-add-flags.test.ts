import { describe, expect, it } from "bun:test"
import { account, accounts, cli, tempHome } from "./tx-test-support"

describe("tx add flags", () => {
	it("replays an identical external ref as a duplicate and a changed one as a conflict", async () => {
		const traj = cli(tempHome())
		const opened = await accounts(traj, [
			["Cash", "asset"],
			["Food", "expense"],
		])
		const argv = [
			"tx",
			"add",
			"--from",
			"Cash",
			"--to",
			"Food",
			"--amount",
			"10.00",
			"--date",
			"2026-03-01",
			"--external-ref",
			"bank:1",
			"--json",
		]
		const first = await traj(argv)
		expect(first.code).toBe(0)
		const added = JSON.parse(first.out)
		expect(added.transaction.postings.map((p: { accountId: string }) => p.accountId)).toEqual([
			opened["Food"]?.id,
			opened["Cash"]?.id,
		])
		const again = await traj(argv)
		expect(again.code).toBe(0)
		const duplicate = JSON.parse(again.out)
		expect(duplicate.status).toBe("duplicate")
		expect(duplicate.transaction.id).toBe(added.transaction.id)
		const changed = [...argv]
		changed[7] = "11.00"
		const conflict = await traj(changed)
		expect(conflict.code).toBe(5)
		expect(JSON.parse(conflict.err).error).toMatchObject({
			code: "external_ref_conflict",
			exitCode: 5,
			details: { externalRef: "bank:1", txId: added.transaction.id },
		})
	})

	it("rolls a dry run back and returns the generated id as null", async () => {
		const traj = cli(tempHome())
		await account(traj, "Cash")
		await account(traj, "Food", "expense")
		const argv = [
			"tx",
			"add",
			"--from",
			"Cash",
			"--to",
			"Food",
			"--amount",
			"10.00",
			"--date",
			"2026-03-01",
			"--external-ref",
			"dry:1",
			"--json",
		]
		const dry = await traj([...argv, "--dry-run"])
		expect(dry.code).toBe(0)
		const data = JSON.parse(dry.out)
		expect(data).toMatchObject({ dryRun: true, status: "added" })
		expect(data.transaction.id).toBeNull()
		expect(data.transaction.postings.map((p: { amount: string }) => p.amount)).toEqual([
			"10.00",
			"-10.00",
		])
		const real = await traj(argv)
		expect(real.code).toBe(0)
		expect(JSON.parse(real.out).status).toBe("added")
	})

	it("rejects an amount above the safe-integer range instead of rounding it", async () => {
		const traj = cli(tempHome())
		await account(traj, "Cash")
		await account(traj, "Food", "expense")
		const res = await traj([
			"tx",
			"add",
			"--from",
			"Cash",
			"--to",
			"Food",
			"--amount",
			"90071992547409.92",
			"--date",
			"2026-03-01",
			"--json",
		])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "INVALID_AMOUNT",
			exitCode: 3,
			path: "amount",
		})
	})

	it("reports a missing account as not_found", async () => {
		const traj = cli(tempHome())
		await account(traj, "Cash")
		const res = await traj([
			"tx",
			"add",
			"--from",
			"Nope",
			"--to",
			"Cash",
			"--amount",
			"1.00",
			"--date",
			"2026-03-01",
			"--json",
		])
		expect(res.code).toBe(4)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "not_found",
			exitCode: 4,
			details: { resource: "account" },
		})
	})

	it("requires the opening contra to be an equity account", async () => {
		const traj = cli(tempHome())
		await account(traj, "Cash")
		await account(traj, "Food", "expense")
		const res = await traj([
			"tx",
			"add",
			"--opening",
			"--from",
			"Food",
			"--to",
			"Cash",
			"--amount",
			"1.00",
			"--date",
			"2026-03-01",
			"--json",
		])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "NON_EQUITY_CONTRA",
			exitCode: 3,
			path: "from.accountId",
		})
	})
})
