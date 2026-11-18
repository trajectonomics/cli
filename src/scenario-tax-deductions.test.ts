import { describe, expect, it } from "bun:test"
import { emitThLevy } from "@trajectonomics/tax/th"
import { projection, projectionHome } from "./projection/testing"
import { runBody } from "./projection-run-support"
import type { ScenarioBody } from "./scenario-test-support"
import { rowOf, scenario } from "./scenario-test-support"
import { type Captured, capture } from "./test-support"

/** `traj scenario tax ...` in JSON against one data directory. */
function tax(home: string, argv: readonly string[]): Promise<Captured> {
	return scenario(home, ["tax", ...argv])
}

/** The document a Scenario write returned. */
function documentOf(data: ReturnType<typeof JSON.parse>): Record<string, unknown> {
	return (rowOf(data) as ScenarioBody).document
}

/** The two flags that make one whole Thai tax year settle inside the Projection. */
const YEAR_FLAGS: readonly string[] = ["--as-of", "2026-01-01", "--horizon", "2027-12-31"]

/** The tax a Scenario's Projection owes for 2026, as the result states it. */
async function owedIn2026(home: string, name: string): Promise<string | undefined> {
	const res = await projection(home, ["run", "--scenario", name, ...YEAR_FLAGS])
	expect(res.code).toBe(0)
	return runBody(res).taxYears.find((it) => it.from === "2026-01-01")?.owed
}

describe("scenario tax deductions", () => {
	it("writes the profile flags into the Levy tax-core emits, and no amount of its own", async () => {
		const home = await projectionHome()
		const res = await tax(home, [
			"base",
			"--tax",
			"th-2026",
			"--filing-status",
			"married_no_income_spouse",
			"--parents",
			"2",
			"--disabled-care",
			"1",
			"--social-security",
			"9000",
			"--life-insurance",
			"20000",
			"--health-insurance",
			"5000",
			"--parent-health-insurance",
			"4000",
			"--spouse-life-insurance",
			"3000",
			"--mortgage-interest",
			"30000",
			"--donation2x",
			"2000",
			"--donation1x",
			"1000",
			"--label",
			"salary=income.section40_1",
		])
		expect(res.code, res.err).toBe(0)
		const levies = documentOf(JSON.parse(res.out))["levies"] as unknown[]
		expect(levies).toEqual([
			emitThLevy({
				filingStatus: "married_no_income_spouse",
				allowances: {
					children: { totalCount: 0, secondPlusBorn2018OrLaterCount: 0 },
					parents: 2,
					disabledCareCount: 1,
					socialSecurity: 9000,
					lifeInsurance: 20000,
					healthInsurance: 5000,
					parentHealthInsurance: 4000,
					spouseLifeInsurance: 3000,
					mortgageInterest: 30000,
					donation2x: 2000,
					donation1x: 1000,
				},
				levy: { id: "th-2026-pit" },
			}),
		])
	})

	it("reports the allowance classes the flags stated and the ones they left out", async () => {
		const home = await projectionHome()
		const res = await tax(home, [
			"base",
			"--tax",
			"th-2026",
			"--life-insurance",
			"20000",
			"--label",
			"salary=income.section40_1",
		])
		expect(res.code).toBe(0)
		const allowances = (JSON.parse(res.out) as { allowances: Record<string, string[]> }).allowances
		expect(allowances["stated"]).toEqual(["lifeInsurance"])
		// The complaint that started this: nothing said these were missing.
		expect(allowances["notStated"]).toContain("socialSecurity")
		expect(allowances["notStated"]).toContain("mortgageInterest")
		expect(allowances["notStated"]).toContain("donation2x")
		expect(allowances["notStated"]).toContain("donation1x")
	})

	it("prints the not-stated list in the human format, so a missing deduction is visible", async () => {
		const home = await projectionHome()
		const res = await capture(
			[
				"scenario",
				"tax",
				"base",
				"--tax",
				"th-2026",
				"--life-insurance",
				"20000",
				"--label",
				"salary=income.section40_1",
			],
			{ TRAJ_HOME: home },
		)
		expect(res.code).toBe(0)
		expect(res.out).toContain("stated:")
		expect(res.out).toContain("notStated:")
		expect(res.out).toContain("socialSecurity")
		expect(res.out).toContain("mortgageInterest")
	})

	it("states retirement contributions only when a Flow carries a label the Levy reads", async () => {
		const home = await projectionHome()
		const res = await tax(home, [
			"base",
			"--tax",
			"th-2026",
			"--label",
			"salary=income.section40_1",
			"--label",
			"invest=allowance.retirement.rmf",
		])
		expect(res.code).toBe(0)
		const allowances = (JSON.parse(res.out) as { allowances: Record<string, string[]> }).allowances
		expect(allowances["stated"]).toContain("retirementContributions")
		expect(allowances["notStated"]).not.toContain("retirementContributions")
	})

	it("lowers the tax a Projection owes when a deduction is stated", async () => {
		const home = await projectionHome()
		const before = await tax(home, [
			"base",
			"--tax",
			"th-2026",
			"--label",
			"salary=income.section40_1",
		])
		expect(before.code).toBe(0)
		expect(await owedIn2026(home, "base")).toBe("36500.00")
		const after = await tax(home, [
			"base",
			"--tax",
			"th-2026",
			"--life-insurance",
			"100000",
			"--label",
			"salary=income.section40_1",
		])
		expect(after.code).toBe(0)
		// 100,000 more off 560,000 taxable saves 13,000: 60,000 of it sits in the 15% band.
		expect(await owedIn2026(home, "base")).toBe("23500.00")
	})
})
