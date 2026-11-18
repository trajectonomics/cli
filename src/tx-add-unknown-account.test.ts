import { describe, expect, it } from "bun:test"
import { UNKNOWN_ACCOUNT_HINT } from "./hint"
import { account, cli, ledgerHome } from "./tx-test-support"

describe("tx add names an account outside the chart", () => {
	it("reports it as UNKNOWN_ACCOUNT, with the hint its siblings carry", async () => {
		const traj = cli(ledgerHome())
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
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "UNKNOWN_ACCOUNT",
			exitCode: 3,
			path: "from",
			hint: UNKNOWN_ACCOUNT_HINT,
		})
	})

	it("names the chart and the way into it on an empty one, after the error line", async () => {
		const traj = cli(ledgerHome())
		const res = await traj([
			"tx",
			"add",
			"--from",
			"Cash",
			"--to",
			"Food",
			"--amount",
			"1",
			"--date",
			"2026-01-01",
		])
		expect(res.code).toBe(3)
		expect(res.err.split("\n")).toEqual([
			'error: UNKNOWN_ACCOUNT (from): from: no account matches "Cash"',
			'hint: Run "traj account list" to see the chart, or "traj account add Cash --type asset --currency THB" to create one.',
		])
	})

	it("carries the same sentence in --json, moving nothing else", async () => {
		const traj = cli(ledgerHome())
		const res = await traj([
			"tx",
			"add",
			"--from",
			"Cash",
			"--to",
			"Food",
			"--amount",
			"1",
			"--date",
			"2026-01-01",
			"--json",
		])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toEqual({
			code: "UNKNOWN_ACCOUNT",
			exitCode: 3,
			path: "from",
			message: 'from: no account matches "Cash"',
			hint: UNKNOWN_ACCOUNT_HINT,
			details: { field: "from", value: "Cash", reason: "is not in the chart of accounts" },
		})
	})
})
