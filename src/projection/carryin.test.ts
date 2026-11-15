import { describe, expect, it } from "bun:test"
import type { Baseline } from "@trajectonomics/sim"
import { check, type Scenario, type Timeline } from "@trajectonomics/sim"
import { withTaxLevy } from "../scenario/tax"
import { withCarryIn } from "./levies"

/*
 * The engine is the oracle for the Carry-in rule. `check()` needs a Carry-in record for every
 * period whose Settlement falls inside the Timeline, and the CLI derives those from the As-of, so
 * a sweep over the dates that move a period boundary is what keeps the derivation honest.
 */

const BASELINE: Baseline = { schemaVersion: 1, balances: [{ account: "cash", amount: 10_000_000 }] }

/** One Scenario with a labelled salary and a labelled retirement contribution. */
const DOCUMENT = {
	schemaVersion: 4,
	currency: "THB",
	economy: { inflation: 0 },
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	flows: [
		{
			id: "salary",
			kind: "income",
			earned: true,
			amount: 8_000_000,
			frequency: "monthly",
			start: "2026-01-31",
			growth: { bps: 0 },
		},
		{
			id: "rmf",
			kind: "contribution",
			target: "cash",
			amount: 100_000,
			frequency: "monthly",
			start: "2026-01-31",
			growth: { bps: 0 },
		},
	],
	cashflow: { surplus: [{ account: "cash" }], contribute: ["cash"], withdraw: ["cash"] },
} as const

/** The document with this build's tax Levy, which is the only Levy the CLI fills a Carry-in for. */
function taxed(): Scenario {
	const written = withTaxLevy(
		DOCUMENT,
		{ jurisdiction: "th-2026", filingStatus: "single", children: 0, childrenAtHigherRate: 0 },
		[
			{ flow: "salary", label: "income.section40_1" },
			{ flow: "rmf", label: "allowance.retirement.rmf" },
		],
	)
	if (!("levies" in (written as object))) throw new Error("the tax Levy was refused")
	return written as unknown as Scenario
}

/** The dates a period boundary can move on: year ends, the Settlement day, a leap day, mid-months. */
const AS_OF_DATES: readonly string[] = [
	"2025-12-31",
	"2026-01-01",
	"2026-01-02",
	"2026-01-31",
	"2026-02-28",
	"2026-03-30",
	"2026-03-31",
	"2026-04-01",
	"2026-06-15",
	"2026-07-31",
	"2026-12-30",
	"2026-12-31",
	"2027-01-01",
	"2027-03-31",
	"2028-02-29",
	"2028-03-30",
	"2028-03-31",
	"2028-04-01",
]

describe("the Carry-in the As-of implies", () => {
	it("satisfies the engine for every date a period boundary can move on", () => {
		const scenario = taxed()
		for (const asOf of AS_OF_DATES) {
			const timeline: Timeline = { start: asOf, horizon: "2029-12-31", resolution: "month" }
			const problems = check(BASELINE, withCarryIn(scenario, asOf), timeline)
			expect({ asOf, problems }).toEqual({ asOf, problems: [] })
		}
	})

	it("adds the previous year only when its Settlement falls inside the Projection", () => {
		const scenario = taxed()
		const starts = (asOf: string) =>
			(withCarryIn(scenario, asOf).levies?.[0]?.carryIn ?? []).map((it) => it.periodStart)
		// The Settlement of 2025 falls on 31 March 2026, so a Projection from the first day of 2026
		// still has to state what 2025 had tallied.
		expect(starts("2026-01-01")).toEqual(["2025-01-01"])
		expect(starts("2026-03-30")).toEqual(["2025-01-01", "2026-01-01"])
		// The engine's rule is `settlement >= start`, so the Settlement day itself still names the
		// previous period; the day after it does not.
		expect(starts("2026-03-31")).toEqual(["2025-01-01", "2026-01-01"])
		expect(starts("2026-04-01")).toEqual(["2026-01-01"])
	})

	it("leaves a Levy the CLI did not emit untouched", () => {
		const own = {
			...taxed(),
			levies: [
				{
					id: "national",
					period: { month: 1, day: 1 },
					settlement: { month: 3, day: 31 },
					measures: [{ id: "due", op: "const" as const, value: 0 }],
					due: "due",
				},
			],
		}
		expect(withCarryIn(own as Scenario, "2026-02-01").levies?.[0]?.carryIn).toBeUndefined()
	})
})
