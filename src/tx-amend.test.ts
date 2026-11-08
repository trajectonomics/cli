import { describe, expect, it } from "bun:test"
import {
	amend,
	cli,
	json,
	ledgerSize,
	lunch,
	tempHome,
	UUID_V7,
	type Written,
} from "./tx-test-support"

describe("tx amend", () => {
	it("writes a reversal and a replacement in one write, both linked to the original", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const res = await amend(traj, original.id)
		expect(res.code).toBe(0)
		const data = json(res)
		expect(data).toMatchObject({ dryRun: false, status: "amended", correction: null })
		expect(data.reversal).toMatchObject({
			date: "2026-03-02",
			linkedTo: original.id,
			externalRef: null,
			version: 1,
		})
		expect(data.replacement).toMatchObject({
			date: "2026-03-02",
			linkedTo: original.id,
			externalRef: null,
			version: 1,
		})
		expect(data.reversal?.id).toMatch(UUID_V7)
		expect(data.replacement?.id).toMatch(UUID_V7)
		expect(data.reversal?.id).not.toBe(data.replacement?.id)
		expect(await ledgerSize(traj)).toEqual({ transactions: 3, postings: 6 })
	})

	it("writes the original's postings with every sign flipped and the amended ones as given", async () => {
		const traj = cli(tempHome())
		const { opened, original } = await lunch(traj)
		const data = json(await amend(traj, original.id))
		expect(data.reversal?.postings).toEqual([
			{
				ordinal: 0,
				accountId: opened["Food"]!.id,
				amount: "-120.50",
				currency: "THB",
				dimensions: null,
			},
			{
				ordinal: 1,
				accountId: opened["Cash"]!.id,
				amount: "120.50",
				currency: "THB",
				dimensions: null,
			},
		])
		expect(data.replacement?.postings).toEqual([
			{
				ordinal: 0,
				accountId: opened["Food"]!.id,
				amount: "100.00",
				currency: "THB",
				dimensions: null,
			},
			{
				ordinal: 1,
				accountId: opened["Cash"]!.id,
				amount: "-100.00",
				currency: "THB",
				dimensions: null,
			},
		])
	})

	it("takes the reversal's date from --void-date, defaulting it to --date", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const defaulted = json(await amend(traj, original.id))
		expect(defaulted.reversal?.date).toBe("2026-03-02")

		const second = await traj([
			"tx",
			"add",
			"--from",
			"Cash",
			"--to",
			"Food",
			"--amount",
			"10",
			"--date",
			"2026-03-03",
			"--json",
		])
		const id = (JSON.parse(second.out).transaction as Written).id
		const dated = json(await amend(traj, id, ["--void-date", "2026-03-04"]))
		expect(dated.reversal?.date).toBe("2026-03-04")
		expect(dated.replacement?.date).toBe("2026-03-02")
	})

	it("returns both rows with a null id under --dry-run and writes nothing", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const dry = await amend(traj, original.id, ["--dry-run"])
		expect(dry.code).toBe(0)
		const data = json(dry)
		expect(data).toMatchObject({ dryRun: true, status: "amended" })
		expect(data.reversal?.id).toBeNull()
		expect(data.replacement?.id).toBeNull()
		expect(data.reversal?.linkedTo).toBe(original.id)
		expect(data.replacement?.linkedTo).toBe(original.id)
		expect(await ledgerSize(traj)).toEqual({ transactions: 1, postings: 2 })

		const real = await amend(traj, original.id)
		expect(real.code).toBe(0)
		expect(json(real).status).toBe("amended")
	})

	it("shows the amendment's rows as ordinary transactions in the list", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const data = json(await amend(traj, original.id))
		const listed = JSON.parse((await traj(["tx", "list", "--json"])).out) as {
			transactions: { id: string; date: string }[]
		}
		const ids = listed.transactions.map((tx) => tx.id).sort()
		expect(ids).toEqual([original.id, data.reversal?.id ?? "", data.replacement?.id ?? ""].sort())
	})

	it("reports an unknown transaction as not_found", async () => {
		const traj = cli(tempHome())
		await lunch(traj)
		const res = await amend(traj, "01940000-0000-7000-8000-000000000000")
		expect(res.code).toBe(4)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "not_found",
			exitCode: 4,
			details: { resource: "transaction" },
		})
	})
})
