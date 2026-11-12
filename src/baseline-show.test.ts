import { describe, expect, it } from "bun:test"
import { cli, type Shown, show, withOne } from "./baseline/testing"
import { FIXTURE_ACCOUNTS, FIXTURE_AS_OF, fixtureHome, seededHome } from "./ledger-fixture"

describe("baseline show", () => {
	it("states the Baseline a Projection starts from: THB, one row per Balance", async () => {
		const res = await show(fixtureHome())
		expect(res.code).toBe(0)
		expect(res.err).toBe("")
		expect(JSON.parse(res.out)).toEqual({
			asOf: FIXTURE_AS_OF,
			currency: "THB",
			rows: [
				{
					account: { id: FIXTURE_ACCOUNTS.bank, name: "Bank" },
					kind: "asset",
					amount: "528549.50",
				},
				{
					account: { id: FIXTURE_ACCOUNTS.cash, name: "Cash" },
					kind: "asset",
					amount: "499900.01",
				},
				{
					account: { id: FIXTURE_ACCOUNTS.investment, name: "Investment" },
					kind: "asset",
					amount: "100000.00",
				},
				{
					account: { id: FIXTURE_ACCOUNTS.loan, name: "Loan" },
					kind: "liability",
					amount: "200000.00",
				},
				{
					account: { id: FIXTURE_ACCOUNTS.locked, name: "Locked" },
					kind: "asset",
					amount: "20000.00",
				},
				{
					account: { id: FIXTURE_ACCOUNTS.oldWallet, name: "Old wallet" },
					kind: "asset",
					amount: "5000.00",
				},
			],
		})
	})

	it("crosses asset and liability leaves only, in ascending Account-id order", async () => {
		const data = JSON.parse((await show(fixtureHome())).out) as Shown
		const names = data.rows.map((row) => row.account.name)
		expect(names).toEqual(["Bank", "Cash", "Investment", "Loan", "Locked", "Old wallet"])
		expect(new Set(data.rows.map((row) => row.kind))).toEqual(new Set(["asset", "liability"]))
		expect(data.rows.map((row) => row.account.id)).toEqual(
			[...data.rows.map((row) => row.account.id)].sort(),
		)
		// The header, the zero Balance, income, expense and equity are all absent.
		for (const absent of ["Assets", "Savings", "Salary", "Food", "Misc", "Opening"]) {
			expect(names).not.toContain(absent)
		}
	})

	it("negates a liability into the positive amount owed", async () => {
		const data = JSON.parse((await show(fixtureHome())).out) as Shown
		expect(data.rows.find((row) => row.account.name === "Loan")).toEqual({
			account: { id: FIXTURE_ACCOUNTS.loan, name: "Loan" },
			kind: "liability",
			amount: "200000.00",
		})
	})

	it("keeps an archived Account's money", async () => {
		const data = JSON.parse((await show(fixtureHome())).out) as Shown
		expect(data.rows.map((row) => row.account.name)).toContain("Old wallet")
	})

	it("gives the same bytes for the same database and As-of", async () => {
		const home = fixtureHome()
		expect(await show(home)).toEqual(await show(home))
	})

	it("is unchanged by a Transaction dated the day after the As-of", async () => {
		const same = await show(fixtureHome())
		const later = await show(seededHome(withOne(FIXTURE_ACCOUNTS.cash, 12345, "2026-04-01")))
		expect(later).toEqual(same)
	})

	it("prints the As-of, the currency and one block per row without --json", async () => {
		const plain = await cli(fixtureHome())(["baseline", "show", "--as-of", FIXTURE_AS_OF])
		expect(plain.code).toBe(0)
		expect(plain.out).toContain(`asOf: ${FIXTURE_AS_OF}`)
		expect(plain.out).toContain("currency: THB")
		expect(plain.out.split("name:").length - 1).toBe(6)
		expect(plain.out).toContain("name: Bank")
		expect(plain.out).toContain("kind: liability")
	})
})
