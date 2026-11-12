import { describe, expect, it } from "bun:test"
import type { AnnualRollup, Projection } from "@trajectonomics/sim"
import { project } from "@trajectonomics/sim"
import { SIM_SCENARIO, SIM_TIMELINE } from "./baseline/fixture"
import { baselineFrom, goldenJson, type Shown, show, withOne } from "./baseline/testing"
import { FIXTURE_ACCOUNTS, FIXTURE_AS_OF, fixtureHome, seededHome } from "./ledger-fixture"

/** The amount the extra Opening balance raises cash by, in THB minor units (500,000 THB). */
const X = 50000000

/** One read of one data directory, and the Projection its rows produce. */
async function projected(home: string): Promise<{ shown: Shown; projection: Projection }> {
	const res = await show(home)
	expect(res.code).toBe(0)
	const shown = JSON.parse(res.out) as Shown
	const result = project(baselineFrom(shown), SIM_SCENARIO, SIM_TIMELINE)
	if (!result.ok) throw new Error(JSON.stringify(result.problems))
	return { shown, projection: result.projection }
}

/** The figures a raised Balance must leave alone; net worth is asserted separately. */
function flowTotals(year: AnnualRollup) {
	return {
		income: year.income,
		expense: year.expense,
		contributions: year.contributions,
		interest: year.interest,
		unmet: year.unmet,
	}
}

/** Every Balance in `after` is `before`'s, but cash's, which carries the whole shift. */
function expectBalancesMoved(
	before: Projection["rows"][number],
	after: Projection["rows"][number],
): void {
	for (const [position, balance] of before.balances.entries()) {
		const moved = after.balances[position]
		expect(moved?.account).toBe(balance.account)
		expect(moved?.amount).toBe(
			balance.account === FIXTURE_ACCOUNTS.cash ? balance.amount + X : balance.amount,
		)
	}
}

/** Every row's net worth is the plain one plus X, and every Balance is the plain one but cash's. */
function expectRowsShifted(plain: Projection, raised: Projection): void {
	expect(raised.rows.length).toBe(plain.rows.length)
	for (const [index, row] of plain.rows.entries()) {
		const moved = raised.rows[index]
		expect({
			date: moved?.date,
			netWorth: moved?.netWorth,
			accessible: moved?.accessibleNetWorth,
		}).toEqual({
			date: row.date,
			netWorth: row.netWorth + X,
			accessible: row.accessibleNetWorth + X,
		})
		expectBalancesMoved(row, moved as Projection["rows"][number])
	}
}

describe("moving one Balance", () => {
	it("moves the opening net worth and every row by exactly the amount, and nothing else", async () => {
		const plain = await projected(fixtureHome())
		const raised = await projected(seededHome(withOne(FIXTURE_ACCOUNTS.cash, X)))
		expect(raised.projection.annual[0]?.openingNetWorth).toBe(
			(plain.projection.annual[0]?.openingNetWorth ?? 0) + X,
		)
		expectRowsShifted(plain.projection, raised.projection)
		for (const [index, year] of plain.projection.annual.entries()) {
			expect(flowTotals(raised.projection.annual[index] as AnnualRollup)).toEqual(flowTotals(year))
		}
	})

	it("leaves every number and the Baseline identical for the day after the As-of", async () => {
		const plain = await projected(fixtureHome())
		const later = await projected(seededHome(withOne(FIXTURE_ACCOUNTS.cash, X, "2026-04-01")))
		expect(later.shown).toEqual(plain.shown)
		expect(goldenJson(later.projection)).toBe(goldenJson(plain.projection))
	})

	it("gives byte-identical output when the same data directory is read twice", async () => {
		for (const home of [
			fixtureHome(),
			seededHome(withOne(FIXTURE_ACCOUNTS.cash, X)),
			seededHome(withOne(FIXTURE_ACCOUNTS.cash, X, "2026-04-01")),
		]) {
			const first = await projected(home)
			const second = await projected(home)
			expect(second.shown).toEqual(first.shown)
			expect(goldenJson(second.projection)).toBe(goldenJson(first.projection))
		}
	})

	it("states the raised Baseline in THB, with cash the only row that moved", async () => {
		const plain = JSON.parse((await show(fixtureHome())).out) as Shown
		const raised = JSON.parse(
			(await show(seededHome(withOne(FIXTURE_ACCOUNTS.cash, X)))).out,
		) as Shown
		expect(raised.currency).toBe("THB")
		expect(raised.asOf).toBe(FIXTURE_AS_OF)
		const amounts = (data: Shown) => new Map(data.rows.map((row) => [row.account.id, row.amount]))
		const before = amounts(plain)
		const after = amounts(raised)
		expect(after).toEqual(
			new Map(
				[...before].map(([id, amount]) => [
					id,
					id === FIXTURE_ACCOUNTS.cash ? "999900.01" : amount,
				]),
			),
		)
	})
})
