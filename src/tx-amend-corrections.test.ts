import { describe, expect, it } from "bun:test"
import { amend, cli, json, ledgerSize, lunch, tempHome } from "./tx-test-support"

describe("tx amend corrections", () => {
	it("names the reversal and the replacement on the original", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const data = json(await amend(traj, original.id))
		const shown = await traj(["tx", "show", original.id, "--json"])
		expect(shown.code).toBe(0)
		const links = JSON.parse(shown.out).links as {
			corrects: unknown
			correction: string | null
			correctedBy: { id: string; date: string; correction: string | null }[]
		}
		expect(links.corrects).toBeNull()
		expect(links.correction).toBeNull()
		const named = new Map(links.correctedBy.map((ref) => [ref.correction, ref]))
		expect(named.get("reversal")).toEqual({
			id: data.reversal?.id as string,
			date: "2026-03-02",
			correction: "reversal",
		})
		expect(named.get("replacement")).toEqual({
			id: data.replacement?.id as string,
			date: "2026-03-02",
			correction: "replacement",
		})
		const replacement = await traj(["tx", "show", data.replacement?.id ?? "", "--json"])
		expect(JSON.parse(replacement.out).links).toMatchObject({
			corrects: { id: original.id, date: "2026-03-01" },
			correction: "replacement",
		})
	})

	it("exits 5 as external_ref_conflict when the replacement reuses the original's reference", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj, "kbank:2026-03-01:0001")
		const res = await amend(traj, original.id, ["--external-ref", "kbank:2026-03-01:0001"])
		expect(res.code).toBe(5)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "external_ref_conflict",
			exitCode: 5,
			path: "externalRef",
			details: { txId: original.id },
		})
		expect(await ledgerSize(traj)).toEqual({ transactions: 1, postings: 2 })
	})

	it("accepts a new reference on the replacement", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj, "kbank:2026-03-01:0001")
		const data = json(await amend(traj, original.id, ["--external-ref", "kbank:2026-03-02:0001"]))
		expect(data.replacement?.externalRef).toBe("kbank:2026-03-02:0001")
		expect(data.reversal?.externalRef).toBeNull()
	})

	it("exits 0 as already_corrected when the transaction is already corrected", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const first = json(await amend(traj, original.id))
		const again = await amend(traj, original.id, ["--amount", "999"])
		expect(again.code).toBe(0)
		const data = json(again)
		expect(data).toMatchObject({
			dryRun: false,
			status: "already_corrected",
			reversal: null,
			replacement: null,
			correction: { id: first.reversal?.id, date: "2026-03-02", linkedTo: original.id },
		})
		expect(await ledgerSize(traj)).toEqual({ transactions: 3, postings: 6 })
	})

	it("writes neither row when the replacement is invalid", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const res = await amend(traj, original.id, ["--to", "Nope"])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({ code: "UNKNOWN_ACCOUNT" })
		expect(await ledgerSize(traj)).toEqual({ transactions: 1, postings: 2 })
	})

	it("rejects a reversal dated before its original as REVERSAL_BEFORE_ORIGINAL on --void-date", async () => {
		const traj = cli(tempHome())
		const { original } = await lunch(traj)
		const res = await amend(traj, original.id, ["--void-date", "2026-02-28"])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "REVERSAL_BEFORE_ORIGINAL",
			exitCode: 3,
			path: "voidDate",
		})
		expect(await ledgerSize(traj)).toEqual({ transactions: 1, postings: 2 })
	})
})
