import { describe, expect, it } from "bun:test"
import { accounts, cli, tempHome, UUID_V7 } from "./tx-test-support"

async function lunch(traj: ReturnType<typeof cli>) {
	const opened = await accounts(traj, [
		["Cash", "asset"],
		["Food", "expense"],
	])
	const added = await traj([
		"tx",
		"add",
		"--from",
		"Cash",
		"--to",
		"Food",
		"--amount",
		"120.50",
		"--date",
		"2026-03-01",
		"--json",
	])
	expect(added.code).toBe(0)
	return {
		opened,
		original: JSON.parse(added.out).transaction as {
			id: string
			postings: { accountId: string; amount: string }[]
		},
	}
}

describe("tx void", () => {
	it("writes the original's postings in order with every sign flipped, linked to it", async () => {
		const traj = cli(tempHome())
		const { opened, original } = await lunch(traj)
		const res = await traj(["tx", "void", original.id, "--date", "2026-03-02", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data).toMatchObject({
			dryRun: false,
			status: "voided",
			transaction: {
				date: "2026-03-02",
				linkedTo: original.id,
				version: 1,
			},
		})
		expect(data.transaction.id).toMatch(UUID_V7)
		expect(data.transaction.postings).toEqual([
			{
				ordinal: 0,
				accountId: opened["Food"]?.id,
				amount: "-120.50",
				currency: "THB",
				dimensions: null,
			},
			{
				ordinal: 1,
				accountId: opened["Cash"]?.id,
				amount: "120.50",
				currency: "THB",
				dimensions: null,
			},
		])
		const net = new Map<string, number>()
		for (const posting of [...original.postings, ...data.transaction.postings]) {
			net.set(posting.accountId, (net.get(posting.accountId) ?? 0) + Number(posting.amount))
		}
		expect([...net.values()]).toEqual([0, 0])
	})

	it("reports an uncancelled correction as already_corrected and writes nothing", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const first = await traj(["tx", "void", original.id, "--date", "2026-03-02", "--json"])
		expect(first.code).toBe(0)
		const reversal = JSON.parse(first.out).transaction

		const again = await traj(["tx", "void", original.id, "--date", "2026-03-03", "--json"])
		expect(again.code).toBe(0)
		const data = JSON.parse(again.out)
		expect(data).toMatchObject({
			dryRun: false,
			status: "already_corrected",
			transaction: {
				id: reversal.id,
				date: "2026-03-02",
				linkedTo: original.id,
			},
		})
		expect(data.transaction.postings).toEqual(reversal.postings)
	})

	it("reports the existing correction before checking a retry's date", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const first = await traj(["tx", "void", original.id, "--date", "2026-03-02", "--json"])
		const reversal = JSON.parse(first.out).transaction
		for (const date of ["2026-02-28", "2026-02-30"]) {
			const again = await traj(["tx", "void", original.id, "--date", date, "--json"])
			expect(again.code).toBe(0)
			expect(JSON.parse(again.out)).toMatchObject({
				status: "already_corrected",
				transaction: { id: reversal.id, date: "2026-03-02" },
			})
		}
	})

	it("restores the original when its reversal is voided, so it accepts a void again", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const first = await traj(["tx", "void", original.id, "--date", "2026-03-02", "--json"])
		const reversal = JSON.parse(first.out).transaction
		const second = await traj(["tx", "void", reversal.id, "--date", "2026-03-03", "--json"])
		expect(second.code).toBe(0)
		expect(JSON.parse(second.out)).toMatchObject({
			status: "voided",
			transaction: { linkedTo: reversal.id },
		})

		const third = await traj(["tx", "void", original.id, "--date", "2026-03-04", "--json"])
		expect(third.code).toBe(0)
		expect(JSON.parse(third.out)).toMatchObject({
			status: "voided",
			transaction: { linkedTo: original.id },
		})
	})

	it("rejects a reversal dated before its original as REVERSAL_BEFORE_ORIGINAL", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const res = await traj(["tx", "void", original.id, "--date", "2026-02-28", "--json"])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "REVERSAL_BEFORE_ORIGINAL",
			exitCode: 3,
			path: "date",
		})
	})

	it("returns the reversal with a null id under --dry-run and writes nothing", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const dry = await traj([
			"tx",
			"void",
			original.id,
			"--date",
			"2026-03-02",
			"--dry-run",
			"--json",
		])
		expect(dry.code).toBe(0)
		const data = JSON.parse(dry.out)
		expect(data).toMatchObject({ dryRun: true, status: "voided" })
		expect(data.transaction.id).toBeNull()
		expect(data.transaction.linkedTo).toBe(original.id)
		expect(data.transaction.postings.map((p: { amount: string }) => p.amount)).toEqual([
			"-120.50",
			"120.50",
		])

		const real = await traj(["tx", "void", original.id, "--date", "2026-03-02", "--json"])
		expect(real.code).toBe(0)
		expect(JSON.parse(real.out).status).toBe("voided")
	})

	it("reports an unknown transaction as not_found", async () => {
		const traj = cli(tempHome())
		await lunch(traj)
		const res = await traj(["tx", "void", "nope", "--date", "2026-03-02", "--json"])
		expect(res.code).toBe(4)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "not_found",
			exitCode: 4,
			details: { resource: "transaction" },
		})
	})
})
