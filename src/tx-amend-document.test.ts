import { describe, expect, it } from "bun:test"
import { cli, lunch, tempHome } from "./tx-test-support"

type Posting = { account: string; amount: string; currency: string }

function document(postings: Posting[], extra: Record<string, unknown> = {}) {
	return {
		date: "2026-03-02",
		memo: "corrected",
		externalRef: "amend:2026-03-02:0001",
		postings,
		...extra,
	}
}

const corrected: Posting[] = [
	{ account: "Food", amount: "100.00", currency: "THB" },
	{ account: "Cash", amount: "-100.00", currency: "THB" },
]

function errorOf(res: { err: string }) {
	return JSON.parse(res.err).error
}

describe("tx amend document", () => {
	it("reads the replacement from --postings, keeping its memo and reference", async () => {
		const home = tempHome()
		const traj = cli(home)
		const { original } = await lunch(traj)
		const amended = await cli(
			home,
			JSON.stringify(document(corrected)),
		)(["tx", "amend", original.id, "--postings", "-", "--json"])
		expect(amended.code).toBe(0)
		const data = JSON.parse(amended.out)
		expect(data).toMatchObject({
			status: "amended",
			replacement: {
				date: "2026-03-02",
				memo: "corrected",
				externalRef: "amend:2026-03-02:0001",
				linkedTo: original.id,
			},
			reversal: { date: "2026-03-02", linkedTo: original.id },
		})
		expect(data.replacement.postings.map((p: { amount: string }) => p.amount)).toEqual([
			"100.00",
			"-100.00",
		])
		expect(data.reversal.postings.map((p: { amount: string }) => p.amount)).toEqual([
			"-120.50",
			"120.50",
		])
	})

	it("accepts --void-date and --dry-run beside the document", async () => {
		const home = tempHome()
		const traj = cli(home)
		const { original } = await lunch(traj)
		const res = await cli(
			home,
			JSON.stringify(document(corrected)),
		)([
			"tx",
			"amend",
			original.id,
			"--postings",
			"-",
			"--void-date",
			"2026-03-05",
			"--dry-run",
			"--json",
		])
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toMatchObject({
			dryRun: true,
			status: "amended",
			reversal: { id: null, date: "2026-03-05" },
			replacement: { id: null, date: "2026-03-02" },
		})
		const listed = JSON.parse((await traj(["tx", "list", "--json"])).out)
		expect(listed.transactions).toHaveLength(1)
	})

	it("refuses to mix the document form with flag-form fields", async () => {
		const home = tempHome()
		const traj = cli(home)
		const { original } = await lunch(traj)
		for (const extra of [
			["--from", "Cash"],
			["--to", "Food"],
			["--amount", "1"],
			["--date", "2026-03-02"],
			["--opening"],
			["--project", "x"],
			["--external-ref", "mixed"],
		]) {
			const res = await cli(
				home,
				JSON.stringify(document(corrected)),
			)(["tx", "amend", original.id, "--postings", "-", ...extra, "--json"])
			expect(res.code).toBe(2)
			expect(errorOf(res)).toMatchObject({ code: "invalid_input", exitCode: 2 })
			expect(errorOf(res).message).toContain("cannot be combined")
		}
	})

	it("rejects a malformed document before writing any row", async () => {
		const home = tempHome()
		const traj = cli(home)
		const { original } = await lunch(traj)
		const res = await cli(home, "{")(["tx", "amend", original.id, "--postings", "-", "--json"])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "postings" })
		const listed = JSON.parse((await traj(["tx", "list", "--json"])).out)
		expect(listed.transactions).toHaveLength(1)
	})
})
