import { describe, expect, it } from "bun:test"
import { carryInFile, taxedHome, thRecord } from "./projection/carry-in-support"
import type { CompareView } from "./projection/compare-view"
import type { FiView } from "./projection/fi-view"
import { errorOf, fi, projection, projectionHome } from "./projection/testing"
import { runBody } from "./projection-run-support"
import { applyScenario, scenario } from "./scenario-test-support"
import { capture } from "./test-support"

/** The two flags that make one whole Thai tax year settle inside the Projection. */
const YEAR_FLAGS: readonly string[] = ["--as-of", "2026-01-01", "--horizon", "2027-12-31"]

/** The Stored document of the `base` Scenario. */
async function documentOf(home: string): Promise<Record<string, unknown>> {
	const shown = await scenario(home, ["show", "base"])
	expect(shown.code).toBe(0)
	return (JSON.parse(shown.out) as { scenario: { document: Record<string, unknown> } }).scenario
		.document
}

/** The salary Flow of a document, as the test edits it. */
function salaryOf(document: Record<string, unknown>): Record<string, unknown> {
	const flows = document["flows"] as Record<string, unknown>[]
	const salary = flows.find((flow) => flow["id"] === "salary")
	if (salary === undefined) throw new Error("the fixture has no salary Flow")
	return salary
}

describe("the tax a Projection says is owed", () => {
	it("reports one tax year per Levy period, with what it owes and what was prepaid", async () => {
		const home = await taxedHome()
		const body = runBody(await projection(home, ["run", "--scenario", "base", ...YEAR_FLAGS]))
		expect(body.tax).toBe("applied")
		// The 2025 year settles on 2026-03-31, inside the Projection, so it is reported too: the
		// CLI wrote its scope record because the As-of starts 2026 and no caller record was given.
		expect(body.taxYears).toHaveLength(3)
		const [previous, first, second] = body.taxYears
		expect(previous).toMatchObject({
			from: "2025-01-01",
			to: "2025-12-31",
			settlementDate: "2026-03-31",
			due: "0.00",
			owed: "0.00",
			settled: true,
		})
		// 9 months of 80,000 THB salary in 2026, less the 100,000 expense cap and 60,000 personal
		// allowance, is 560,000 taxable: 7,500 + 20,000 + 9,000 = 36,500 THB, settled March 2027.
		expect(first).toEqual({
			levy: "th-2026-pit",
			from: "2026-01-01",
			to: "2026-12-31",
			settlementDate: "2027-03-31",
			due: "36500.00",
			prepaid: "0.00",
			owed: "36500.00",
			settled: true,
			partial: false,
		})
		// The 2027 period is complete at the Horizon but its Settlement is after it, so the tax it
		// owes is reported without a charge in the Projection.
		expect(second).toMatchObject({
			levy: "th-2026-pit",
			from: "2027-01-01",
			to: "2027-12-31",
			settlementDate: "2028-03-31",
			settled: false,
			partial: false,
		})
		for (const year of body.taxYears) {
			expect(Number(year.owed)).toBeCloseTo(Number(year.due) - Number(year.prepaid), 2)
		}
	})

	it("reports a refund as a negative owed figure", async () => {
		const home = await taxedHome()
		const document = await documentOf(home)
		// 10% taken at source on 720,000 of salary is 72,000, which is 35,500 more than the tax owed.
		salaryOf(document)["prepayments"] = [{ levy: "th-2026-pit", bps: 1000 }]
		const applied = await applyScenario(home, "prepaid", document)
		expect(applied.code).toBe(0)
		const body = runBody(await projection(home, ["run", "--scenario", "prepaid", ...YEAR_FLAGS]))
		const year = body.taxYears.find((it) => it.from === "2026-01-01")
		expect(year).toMatchObject({ due: "36500.00", prepaid: "72000.00", owed: "-35500.00" })
	})

	it("says a tax year has not settled when its settlement date is past the Horizon", async () => {
		const home = await taxedHome()
		// The fixture As-of is 2026-03-31 and the Horizon 2027-03-30, one day before the 2026
		// Settlement, so the tax the year owes is reported but no charge reaches the Projection.
		const file = carryInFile(home, [thRecord({ periodStart: "2025-01-01" }), thRecord()])
		const res = await projection(home, [
			"run",
			"--scenario",
			"base",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2027-03-30",
			"--carry-in",
			file,
		])
		expect(res.code).toBe(0)
		const year = runBody(res).taxYears.find((it) => it.from === "2026-01-01")
		expect(year).toMatchObject({ settlementDate: "2027-03-31", settled: false, partial: false })
		expect(year?.owed).toBe("36500.00")
	})

	it("reports an empty list when the Scenario holds no Levy", async () => {
		const home = await projectionHome()
		const body = runBody(await projection(home, ["run", "--scenario", "base", ...YEAR_FLAGS]))
		expect(body.tax).toBe("not_applied")
		expect(body.taxYears).toEqual([])
	})

	it("gives fi the same tax years the same Scenario projects", async () => {
		const home = await taxedHome()
		const run = runBody(await projection(home, ["run", "--scenario", "base", ...YEAR_FLAGS]))
		const answer = JSON.parse((await fi(home, ["--scenario", "base", ...YEAR_FLAGS])).out) as FiView
		expect(answer.taxYears).toEqual(run.taxYears)
	})

	it("gives each side of a compare its own tax years, and an untaxed side none", async () => {
		const home = await taxedHome()
		const res = await projection(home, ["compare", "base", "unreachable", ...YEAR_FLAGS])
		expect(res.code).toBe(0)
		const body = JSON.parse(res.out) as CompareView
		expect(body.tax).toBe("mixed")
		expect(body.sides.a.taxYears).toHaveLength(3)
		expect(body.sides.b.taxYears).toEqual([])
	})

	it("prints the tax years as a table in the human format", async () => {
		const home = await taxedHome()
		const res = await capture(["projection", "run", "--scenario", "base", ...YEAR_FLAGS], {
			TRAJ_HOME: home,
		})
		expect(res.code).toBe(0)
		expect(res.out).toContain("taxYears (3 rows)")
		expect(res.out).toContain("settlementDate")
		expect(res.out).toContain("36500.00")
	})

	it("refuses an As-of outside the supported Gregorian years, naming the range", async () => {
		const home = await projectionHome()
		// 2569 is 2026 in the Buddhist calendar: accepted as a Gregorian year by the Ledger, which
		// is why the CLI refuses it rather than projecting the year 2569.
		const res = await projection(home, [
			"run",
			"--scenario",
			"base",
			"--as-of",
			"2569-03-01",
			"--horizon",
			"2027-03-30",
		])
		expect(res.code).toBe(3)
		const error = errorOf(res)
		expect(error).toMatchObject({ code: "INVALID_DATE", path: "asOf" })
		expect(error.message).toContain("1900-2100")
	})

	it("refuses a Horizon outside the supported Gregorian years at its own flag", async () => {
		const home = await projectionHome()
		const res = await projection(home, [
			"run",
			"--scenario",
			"base",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2569-03-30",
		])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "--horizon" })
	})
})
