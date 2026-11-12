import { describe, expect, it } from "bun:test"
import {
	cli,
	edited,
	overflowingCash,
	show,
	twoUnrepresentable,
	UNBALANCE,
	withOne,
} from "./baseline/testing"
import { FIXTURE_ACCOUNTS, FIXTURE_AS_OF, fixtureHome, seededHome } from "./ledger-fixture"
import { tempHome } from "./store/testing"

describe("baseline show failures", () => {
	it("refuses an overdrawn asset as NEGATIVE_AMOUNT with both amounts in details", async () => {
		const res = await show(seededHome(withOne(FIXTURE_ACCOUNTS.cash, -49990002)))
		expect(res.code).toBe(3)
		expect(res.out).toBe("")
		const { error } = JSON.parse(res.err)
		expect(error).toMatchObject({
			code: "NEGATIVE_AMOUNT",
			exitCode: 3,
			path: `rows.${FIXTURE_ACCOUNTS.cash}`,
			details: {
				account: { id: FIXTURE_ACCOUNTS.cash, name: "Cash" },
				kind: "asset",
				currency: "THB",
				ledgerAmount: "-0.01",
				baselineAmount: "-0.01",
			},
		})
		expect(error.message).toContain("Cash")
	})

	it("refuses an overpaid loan with the amount it would have to claim", async () => {
		const res = await show(seededHome(withOne(FIXTURE_ACCOUNTS.loan, 20000001)))
		expect(res.code).toBe(3)
		const { error } = JSON.parse(res.err)
		expect(error).toMatchObject({
			code: "NEGATIVE_AMOUNT",
			path: `rows.${FIXTURE_ACCOUNTS.loan}`,
			details: {
				account: { id: FIXTURE_ACCOUNTS.loan, name: "Loan" },
				kind: "liability",
				ledgerAmount: "0.01",
				baselineAmount: "-0.01",
			},
		})
	})

	it("reports the first unrepresentable Account by id, deterministically", async () => {
		const res = await show(seededHome(twoUnrepresentable()))
		expect(res.code).toBe(3)
		// Cash's id sorts before Loan's, whatever order the rows were written in.
		expect(JSON.parse(res.err).error.path).toBe(`rows.${FIXTURE_ACCOUNTS.cash}`)
	})

	it("gives AMOUNT_OVERFLOW on the Account's row when two Balances sum past the range", async () => {
		const res = await show(seededHome(overflowingCash()))
		expect(res.code).toBe(3)
		expect(res.out).toBe("")
		const { error } = JSON.parse(res.err)
		expect(error).toMatchObject({
			code: "AMOUNT_OVERFLOW",
			exitCode: 3,
			path: `rows.${FIXTURE_ACCOUNTS.cash}`,
		})
	})

	it("refuses a hand-edited Account in another currency", async () => {
		const home = edited(
			fixtureHome(),
			`UPDATE account SET currency = 'USD' WHERE id = '${FIXTURE_ACCOUNTS.savings}'`,
		)
		const res = await show(home)
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "unsupported_currency",
			exitCode: 3,
			path: `rows.${FIXTURE_ACCOUNTS.savings}`,
		})
	})

	it("reports a hand-edited unbalanced Transaction with the core's own code", async () => {
		const res = await show(edited(fixtureHome(), UNBALANCE))
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "UNBALANCED_TRANSACTION",
			exitCode: 3,
			path: "transactions.0194b000-0003-7000-8000-000000000003",
		})
	})

	it("rejects a bad date before it reads the store", async () => {
		const res = await cli(edited(fixtureHome(), UNBALANCE))([
			"baseline",
			"show",
			"--as-of",
			"2026-02-30",
			"--json",
		])
		expect(res.code).toBe(3)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "INVALID_DATE",
			exitCode: 3,
			path: "asOf",
		})
	})
})

describe("baseline show surface", () => {
	it("requires --as-of, from the input layer", async () => {
		const res = await cli(tempHome())(["baseline", "show", "--json"])
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error).toMatchObject({
			code: "invalid_input",
			exitCode: 2,
			path: "asOf",
		})
	})

	it("renders an empty Ledger as no rows at exit 0, still stating THB", async () => {
		const res = await show(tempHome())
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toEqual({ asOf: FIXTURE_AS_OF, currency: "THB", rows: [] })
	})

	it("prints the group's usage when no subcommand is given", async () => {
		const res = await cli(fixtureHome())(["baseline"])
		expect(res.code).toBe(0)
		expect(res.out).toContain("Usage: traj baseline <command>")
		expect(res.out).toContain("show")
	})

	it("rejects a flag it does not declare, naming it", async () => {
		const res = await cli(fixtureHome())([
			"baseline",
			"show",
			"--as-of",
			FIXTURE_AS_OF,
			"--from",
			"x",
			"--json",
		])
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error.code).toBe("unknown_flag")
	})

	it("describes itself through traj schema", async () => {
		const res = await cli(fixtureHome())(["schema", "baseline", "show", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.name).toBe("baseline show")
		expect(data.input.properties.asOf).toBeDefined()
		expect(data.output.properties.rows).toBeDefined()
		for (const code of [
			"INVALID_DATE",
			"NEGATIVE_AMOUNT",
			"AMOUNT_OVERFLOW",
			"unsupported_currency",
		]) {
			expect(data.errorCodes).toContain(code)
		}
	})
})
