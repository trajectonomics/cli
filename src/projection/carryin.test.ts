import { describe, expect, it } from "bun:test"
import type { Baseline, TallyBasis } from "@trajectonomics/sim"
import { check, type Scenario, type Timeline } from "@trajectonomics/sim"
import { isAppError } from "../errors"
import type { ScenarioDocument } from "../scenario/document"
import { taxRequestOf, withTaxLevy } from "../scenario/tax"
import { TH_CLASSES } from "./carry-in-support"
import type { CarryInRecordForm } from "./carryin"
import { placeCarryIn } from "./carryin-place"

/*
 * The engine is the oracle for the Carry-in rule. `check()` needs a record for every period whose
 * Settlement falls inside the Timeline, and the CLI derives those from the As-of, so a sweep over
 * the dates that move a period boundary is what keeps the derivation honest.
 */

const BASELINE: Baseline = { schemaVersion: 1, balances: [{ account: "cash", amount: 10_000_000 }] }

/** The Thai Levy's classes, as its own measures read them: 22 income, 7 allowances. */
const CLASSES: readonly { label: string; basis: TallyBasis }[] = TH_CLASSES

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

/** The document with this build's tax Levy, the only one whose scope record the CLI can write. */
function taxed(): Scenario {
	const request = taxRequestOf({ tax: "th-2026", filingStatus: "single" })
	if (request === null || isAppError(request)) throw new Error("the tax request was refused")
	const written = withTaxLevy(DOCUMENT, request, [
		{ flow: "salary", label: "income.section40_1" },
		{ flow: "rmf", label: "allowance.retirement.rmf" },
	])
	if (!("levies" in (written as object))) throw new Error("the tax Levy was refused")
	return written as unknown as Scenario
}

/** The period the Levy's year starts on, which is the first of January for the Thai Levy. */
function currentOf(asOf: string): string {
	return asOf.slice(5) === "01-01" ? asOf : `${asOf.slice(0, 4)}-01-01`
}

/** A caller's record for the period the As-of starts inside, every class stated as zero. */
function stated(asOf: string): CarryInRecordForm[] {
	return [
		{
			scenario: "base",
			levy: "th-2026-pit",
			periodStart: currentOf(asOf),
			tallies: CLASSES.map(({ label, basis }) => ({ label, basis, amount: "0.00" })),
			prepaid: "0.00",
		},
	]
}

/** The document with the Carry-in placed, or the sentence its refusal carried. */
function placed(asOf: string, records: readonly CarryInRecordForm[]): Scenario | string {
	const result = placeCarryIn({
		document: taxed() as unknown as ScenarioDocument,
		scenario: { id: "an-id", name: "base", path: "scenario" },
		asOf,
		currency: "THB",
		records,
	})
	return isAppError(result) ? result.body.message : (result.document as unknown as Scenario)
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
		for (const asOf of AS_OF_DATES) {
			const timeline: Timeline = { start: asOf, horizon: "2029-12-31", resolution: "month" }
			const midPeriod = asOf !== currentOf(asOf)
			const scenario = placed(asOf, midPeriod ? stated(asOf) : [])
			if (typeof scenario === "string") throw new Error(`${asOf}: ${scenario}`)
			const problems = check(BASELINE, scenario, timeline)
			expect({ asOf, problems }).toEqual({ asOf, problems: [] })
		}
	})

	it("writes the scope record only for a period that ended before the As-of", () => {
		const starts = (asOf: string, records: readonly CarryInRecordForm[]) => {
			const scenario = placed(asOf, records)
			if (typeof scenario === "string") throw new Error(`${asOf}: ${scenario}`)
			return (scenario.levies?.[0]?.carryIn ?? []).map((it) => it.periodStart)
		}
		// The Settlement of 2025 falls on 31 March 2026, so a Projection from the first day of 2026
		// still has to state what 2025 had tallied, and the CLI states the empty record it can vouch
		// for; the period the As-of starts inside is always the caller's.
		expect(starts("2026-01-01", [])).toEqual(["2025-01-01"])
		expect(starts("2026-03-30", stated("2026-03-30"))).toEqual(["2025-01-01", "2026-01-01"])
		// The engine's rule is `settlement >= start`, so the Settlement day itself still names the
		// previous period; the day after it does not.
		expect(starts("2026-03-31", stated("2026-03-31"))).toEqual(["2025-01-01", "2026-01-01"])
		expect(starts("2026-04-01", stated("2026-04-01"))).toEqual(["2026-01-01"])
	})

	it("refuses a Levy it did not emit where the empty record would be an invention", () => {
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
		const result = placeCarryIn({
			document: own as unknown as ScenarioDocument,
			scenario: { id: "an-id", name: "base", path: "scenario" },
			asOf: "2026-01-01",
			currency: "THB",
			records: [],
		})
		if (!isAppError(result)) throw new Error("the own Levy's missing record was accepted")
		// The field name, not the flag: the dispatch step spells `--carry-in` on the wire (ADR-0013).
		expect(result.body).toMatchObject({ code: "invalid_input", path: "carryIn" })
		expect(result.body.message).toContain('Levy "national"')
		expect(result.body.message).toContain("2025-01-01")
	})
})
