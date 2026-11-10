import { describe, expect, it } from "bun:test"
import { FIXTURE_AS_OF, fixtureHome, overflowRows, seededHome } from "./ledger-fixture"
import { golden } from "./report/testing"
import { tempHome } from "./store/testing"
import { capture } from "./test-support"

function cli(home: string) {
	return (argv: string[]) => capture(argv, { TRAJ_HOME: home })
}

function networth(home: string, ...args: string[]) {
	return cli(home)(["report", "networth", "--as-of", FIXTURE_AS_OF, ...args, "--json"])
}

type Row = { account: { name: string }; type: string; amount: string; currency: string }

describe("report networth", () => {
	it("reports the asset and liability rows and the total per currency", async () => {
		const res = await networth(fixtureHome())
		expect(res.code).toBe(0)
		expect(res.err).toBe("")
		expect(res.out).toBe(await golden("networth.jsonl"))
	})

	it("leaves equity, income and expense out, header Accounts absent and zeros present", async () => {
		const data = JSON.parse((await networth(fixtureHome())).out) as { rows: Row[] }
		expect(data.rows.map((row) => row.account.name)).toEqual([
			"Bank",
			"Cash",
			"Investment",
			"Loan",
			"Locked",
			"Old wallet",
			"Savings",
		])
		expect(new Set(data.rows.map((row) => row.type))).toEqual(new Set(["asset", "liability"]))
		expect(data.rows.find((row) => row.account.name === "Savings")?.amount).toBe("0.00")
	})

	it("agrees with balance's net worth at the same date", async () => {
		const home = fixtureHome()
		const balance = JSON.parse(
			(await cli(home)(["balance", "--as-of", FIXTURE_AS_OF, "--json"])).out,
		)
		const networthResult = JSON.parse((await networth(home)).out)
		expect(networthResult.totals).toEqual(balance.netWorth)
		const counted = balance.rows.filter(
			(row: Row) => row.type === "asset" || row.type === "liability",
		)
		expect(networthResult.rows).toEqual(counted)
	})

	it("renders an empty Ledger as empty arrays at exit 0", async () => {
		const res = await networth(tempHome())
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toEqual({ asOf: FIXTURE_AS_OF, rows: [], totals: [] })
	})

	it("requires --as-of", async () => {
		const res = await cli(tempHome())(["report", "networth", "--json"])
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "invalid_input",
			exitCode: 2,
			path: "asOf",
		})
	})

	it("rejects a bad date as INVALID_DATE at asOf", async () => {
		const res = await cli(tempHome())(["report", "networth", "--as-of", "2026-02-30", "--json"])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({ code: "INVALID_DATE", path: "asOf" })
	})

	it("rejects every date-range and Dimension flag by name", async () => {
		const home = tempHome()
		const cases = [
			["--from", "Cash"],
			["--to", "Cash"],
			["--since", "2026-01-01"],
			["--until", FIXTURE_AS_OF],
			["--project", "venture"],
		]
		for (const args of cases) {
			const res = await networth(home, ...args)
			expect(res.code).toBe(2)
			const { error } = JSON.parse(res.err)
			expect(error.code).toBe("unknown_flag")
			expect(error.message).toContain(args[0] ?? "")
		}
	})

	it("reports an overflow outside the reported rows at totals", async () => {
		const res = await networth(seededHome(overflowRows()))
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "AMOUNT_OVERFLOW",
			exitCode: 3,
			path: "totals",
		})
	})

	it("gives byte-identical output for the same database and arguments", async () => {
		const home = fixtureHome()
		expect(await networth(home)).toEqual(await networth(home))
	})

	it("describes the leaf through the schema command", async () => {
		const data = JSON.parse((await cli(tempHome())(["schema", "report", "networth", "--json"])).out)
		expect(data.name).toBe("report networth")
		expect(data.input.required).toEqual(["asOf"])
		expect(data.input.properties.project).toBeUndefined()
	})
})
