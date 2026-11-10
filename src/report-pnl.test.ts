import { describe, expect, it } from "bun:test"
import {
	FIXTURE_ACCOUNTS,
	FIXTURE_AS_OF,
	fixtureHome,
	overflowRows,
	seededHome,
} from "./ledger-fixture"
import { golden } from "./report/testing"
import { tempHome } from "./store/testing"
import { capture } from "./test-support"

function cli(home: string) {
	return (argv: string[]) => capture(argv, { TRAJ_HOME: home })
}

function pnl(home: string, ...args: string[]) {
	return cli(home)(["report", "pnl", ...args, "--json"])
}

type Row = { account: { name: string }; type: string; amount: string }

function amounts(res: { out: string }): Record<string, string> {
	const rows = (JSON.parse(res.out) as { rows: Row[] }).rows
	return Object.fromEntries(rows.map((row) => [row.account.name, row.amount]))
}

describe("report pnl", () => {
	it("reports income minus expenses over an inclusive period", async () => {
		const res = await pnl(fixtureHome(), "--since", "2026-03-01", "--until", FIXTURE_AS_OF)
		expect(res.code).toBe(0)
		expect(res.err).toBe("")
		expect(res.out).toBe(await golden("pnl.jsonl"))
	})

	it("leaves income and expense rows in account list order, zeros included", async () => {
		const res = await pnl(fixtureHome(), "--until", FIXTURE_AS_OF)
		const data = JSON.parse(res.out) as { rows: Row[] }
		expect(data.rows.map((row) => row.account.name)).toEqual(["Food", "Misc", "Salary"])
		expect(data.rows.every((row) => row.type === "expense" || row.type === "income")).toBe(true)
	})

	it("starts at the ledger's beginning when --since is omitted and echoes null", async () => {
		const data = JSON.parse((await pnl(fixtureHome(), "--until", FIXTURE_AS_OF)).out)
		expect(data.since).toBeNull()
		expect(data.project).toBeNull()
		expect(data.totals).toEqual([{ currency: "THB", amount: "78449.51" }])
	})

	it("counts a posting on either end date and not the day after --until", async () => {
		const home = fixtureHome()
		const period = async (since: string, until: string) =>
			amounts(await pnl(home, "--since", since, "--until", until))
		expect(await period("2026-03-20", FIXTURE_AS_OF)).toMatchObject({ Food: "299.99" })
		expect(await period("2026-03-21", FIXTURE_AS_OF)).toMatchObject({ Food: "99.99" })
		expect(await period("2026-03-20", "2026-03-30")).toMatchObject({ Food: "200.00" })
		expect(await period("2026-03-20", "2026-04-01")).toMatchObject({ Food: "311.10" })
	})

	it("filters rows and totals to one Project, and echoes it", async () => {
		const data = JSON.parse(
			(await pnl(fixtureHome(), "--until", FIXTURE_AS_OF, "--project", "venture")).out,
		)
		expect(data.project).toBe("venture")
		expect(Object.fromEntries(data.rows.map((row: Row) => [row.account.name, row.amount]))).toEqual(
			{
				Food: "200.00",
				Misc: "0.00",
				Salary: "-50000.00",
			},
		)
		expect(data.totals).toEqual([{ currency: "THB", amount: "49800.00" }])
	})

	it("reports an unused Project as zeros at exit 0", async () => {
		const res = await pnl(fixtureHome(), "--until", FIXTURE_AS_OF, "--project", "unused")
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.rows.map((row: Row) => row.amount)).toEqual(["0.00", "0.00", "0.00"])
		expect(data.totals).toEqual([{ currency: "THB", amount: "0.00" }])
	})

	it("renders an empty Ledger as empty arrays at exit 0", async () => {
		const res = await pnl(tempHome(), "--until", FIXTURE_AS_OF)
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toEqual({
			since: null,
			until: FIXTURE_AS_OF,
			project: null,
			rows: [],
			totals: [],
		})
	})

	it("rejects an inverted period as INVALID_PERIOD at since", async () => {
		const res = await pnl(fixtureHome(), "--since", "2026-04-01", "--until", "2026-03-31")
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "INVALID_PERIOD",
			exitCode: 3,
			path: "since",
		})
	})

	it("rejects a bad date as INVALID_DATE at its own flag", async () => {
		const until = await pnl(fixtureHome(), "--until", "2026-02-30")
		expect(until.code).toBe(3)
		expect(JSON.parse(until.err).error).toMatchObject({ code: "INVALID_DATE", path: "until" })
		const since = await pnl(fixtureHome(), "--since", "2026-02-30", "--until", FIXTURE_AS_OF)
		expect(since.code).toBe(3)
		expect(JSON.parse(since.err).error).toMatchObject({ code: "INVALID_DATE", path: "since" })
	})

	it("rejects an empty --project as invalid_input at project", async () => {
		const res = await pnl(fixtureHome(), "--until", FIXTURE_AS_OF, "--project", "")
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error).toMatchObject({ code: "invalid_input", path: "project" })
	})

	it("rejects --from and --to, which name accounts, not dates", async () => {
		const res = await cli(fixtureHome())([
			"report",
			"pnl",
			"--from",
			"2026-01-01",
			"--to",
			FIXTURE_AS_OF,
			"--json",
		])
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error.code).toBe("unknown_flag")
	})

	it("reports a row total beyond the safe range at the row", async () => {
		const res = await pnl(seededHome(overflowRows()), "--until", FIXTURE_AS_OF)
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "AMOUNT_OVERFLOW",
			exitCode: 3,
			path: `rows[${FIXTURE_ACCOUNTS.food}]`,
		})
	})

	it("prints the report as readable text by default", async () => {
		const res = await cli(fixtureHome())([
			"report",
			"pnl",
			"--since",
			"2026-03-01",
			"--until",
			FIXTURE_AS_OF,
		])
		expect(res.code).toBe(0)
		expect(res.out).toContain("since: 2026-03-01")
		expect(res.out).toContain("project: null")
		expect(res.out).toContain("name: Food")
		expect(res.out).toContain("amount: 299.99")
	})

	it("gives byte-identical output for the same database and arguments", async () => {
		const home = fixtureHome()
		const argv = ["--since", "2026-01-01", "--until", FIXTURE_AS_OF]
		expect(await pnl(home, ...argv)).toEqual(await pnl(home, ...argv))
	})

	it("prints the group's usage for a bare report and names an unknown leaf", async () => {
		const bare = await cli(tempHome())(["report"])
		expect(bare.code).toBe(0)
		expect(bare.out).toContain("Usage: traj report <command>")
		expect(bare.out).toContain("pnl")
		const missing = await cli(tempHome())(["report", "nope", "--json"])
		expect(missing.code).toBe(2)
		expect(JSON.parse(missing.err).error).toMatchObject({
			code: "unknown_command",
			message: "Unknown command: report nope",
		})
	})

	it("describes the leaf through the schema command", async () => {
		const data = JSON.parse((await cli(tempHome())(["schema", "report", "pnl", "--json"])).out)
		expect(data.name).toBe("report pnl")
		expect(data.input.required).toEqual(["until"])
		expect(data.errorCodes).toContain("INVALID_PERIOD")
	})
})
