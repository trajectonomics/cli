import { describe, expect, it } from "bun:test"
import { FIXTURE_AS_OF, fixtureHome } from "./ledger-fixture"
import { golden } from "./report/testing"
import { tempHome } from "./store/testing"
import { capture } from "./test-support"

function cli(home: string) {
	return (argv: string[]) => capture(argv, { TRAJ_HOME: home })
}

function balance(home: string, ...args: string[]) {
	return cli(home)(["balance", "--as-of", FIXTURE_AS_OF, ...args, "--json"])
}

type Row = { account: { id: string; name: string }; type: string; amount: string; currency: string }

function rowsOf(res: { out: string }): Row[] {
	return (JSON.parse(res.out) as { rows: Row[] }).rows
}

describe("balance", () => {
	it("states every leaf Account's balance and the net worth at the As-of", async () => {
		const res = await balance(fixtureHome())
		expect(res.code).toBe(0)
		expect(res.err).toBe("")
		expect(res.out).toBe(await golden("balance.jsonl"))
	})

	it("orders rows as account list does and leaves header Accounts out", async () => {
		const res = await balance(fixtureHome())
		expect(rowsOf(res).map((row) => row.account.name)).toEqual([
			"Bank",
			"Cash",
			"Food",
			"Investment",
			"Loan",
			"Locked",
			"Misc",
			"Old wallet",
			"Opening",
			"Salary",
			"Savings",
		])
	})

	it("keeps a zero Balance and an archived Account's Balance", async () => {
		const data = JSON.parse((await balance(fixtureHome())).out) as {
			rows: Row[]
			netWorth: { currency: string; amount: string }[]
		}
		const amount = (name: string) => data.rows.find((row) => row.account.name === name)?.amount
		expect(amount("Misc")).toBe("0.00")
		expect(amount("Savings")).toBe("0.00")
		expect(amount("Old wallet")).toBe("5000.00")
		expect(amount("Loan")).toBe("-200000.00")
		expect(data.netWorth).toEqual([{ currency: "THB", amount: "953449.51" }])
	})

	it("counts a posting dated on the As-of and not the next day's", async () => {
		const home = fixtureHome()
		const asOf = async (date: string) =>
			JSON.parse((await cli(home)(["balance", "--as-of", date, "--json"])).out) as { rows: Row[] }
		const amountOn = (data: { rows: Row[] }, name: string) =>
			data.rows.find((row) => row.account.name === name)?.amount
		expect(amountOn(await asOf("2026-03-30"), "Cash")).toBe("500000.00")
		expect(amountOn(await asOf("2026-03-30"), "Food")).toBe("1450.50")
		expect(amountOn(await asOf(FIXTURE_AS_OF), "Cash")).toBe("499900.01")
		expect(amountOn(await asOf("2026-04-01"), "Cash")).toBe("499888.90")
		expect(amountOn(await asOf("2026-04-01"), "Food")).toBe("1561.60")
	})

	it("renders an empty Ledger as empty arrays at exit 0", async () => {
		const res = await balance(tempHome())
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toEqual({ asOf: FIXTURE_AS_OF, rows: [], netWorth: [] })
	})

	it("omits the optional trialBalance key unless it was asked for", async () => {
		const data = JSON.parse((await balance(fixtureHome())).out) as Record<string, unknown>
		expect(Object.hasOwn(data, "trialBalance")).toBe(false)
	})

	it("gives byte-identical output for the same database and arguments", async () => {
		const home = fixtureHome()
		const first = await balance(home)
		const second = await balance(home)
		expect(second).toEqual(first)
	})

	it("rejects a missing --as-of as invalid_input at asOf", async () => {
		const res = await cli(tempHome())(["balance", "--json"])
		expect(res.code).toBe(2)
		const { error } = JSON.parse(res.err)
		expect(error).toMatchObject({ code: "invalid_input", exitCode: 2, path: "asOf" })
	})

	it("rejects a bad date as INVALID_DATE at asOf", async () => {
		const res = await cli(fixtureHome())(["balance", "--as-of", "2026-02-30", "--json"])
		expect(res.code).toBe(3)
		const { error } = JSON.parse(res.err)
		expect(error).toMatchObject({ code: "INVALID_DATE", exitCode: 3, path: "asOf" })
	})

	it("rejects a flag it does not declare, naming it", async () => {
		const res = await cli(fixtureHome())([
			"balance",
			"--as-of",
			FIXTURE_AS_OF,
			"--project",
			"venture",
			"--json",
		])
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error).toMatchObject({ code: "unknown_flag", exitCode: 2 })
		expect(JSON.parse(res.err).error.message).toContain("--project")
	})

	it("prints the same result as readable text by default", async () => {
		const res = await cli(fixtureHome())(["balance", "--as-of", FIXTURE_AS_OF])
		expect(res.code).toBe(0)
		expect(res.out).toContain(`asOf: ${FIXTURE_AS_OF}`)
		expect(res.out).toContain("name: Bank")
		expect(res.out).toContain("amount: 528549.50")
		expect(res.out).toContain("currency: THB")
	})

	it("describes the leaf through the schema command", async () => {
		const res = await cli(tempHome())(["schema", "balance", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.name).toBe("balance")
		expect(data.input.required).toContain("asOf")
		expect(data.output.properties.netWorth.type).toBe("array")
		expect(data.errorCodes).toContain("INVALID_DATE")
	})
})
