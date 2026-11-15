import { describe, expect, it } from "bun:test"
import { SIM_SCENARIO } from "./baseline/fixture"
import { errorOf, projection, projectionHome, seededHome } from "./projection/testing"
import { runBody, tableOf } from "./projection-run-support"
import { applyScenario, scenario } from "./scenario-test-support"
import type { Captured } from "./test-support"

/** `traj scenario tax ...` in JSON against one data directory. */
function tax(home: string, argv: readonly string[]): Promise<Captured> {
	return scenario(home, ["tax", ...argv])
}

/** The stored document of a Scenario, as `scenario show` prints it. */
async function documentOf(home: string, name: string): Promise<Record<string, unknown>> {
	const res = await scenario(home, ["show", name])
	expect(res.code).toBe(0)
	return (JSON.parse(res.out) as { scenario: { document: Record<string, unknown> } }).scenario
		.document
}

/** The last annual row's closing net worth as the CLI renders it. */
function lastClosing(res: Captured): string {
	return tableOf(runBody(res), "annual").rows.at(-1)?.closingNetWorth ?? ""
}

/** A whole tax year, so one Settlement falls inside the Projection. */
const YEAR_FLAGS: readonly string[] = ["--as-of", "2026-01-01", "--horizon", "2027-12-31"]

describe("scenario tax", () => {
	it("writes the Levy and the label a taxed Flow needs, and the projection reports it", async () => {
		const home = await projectionHome()
		const applied = await tax(home, [
			"base",
			"--tax",
			"th-2026",
			"--filing-status",
			"married_joint",
			"--children",
			"1",
			"--label",
			"salary=income.section40_1",
		])
		expect(applied.code).toBe(0)
		const saved = JSON.parse(applied.out) as { status: string; scenario: { contentHash: string } }
		expect(saved.status).toBe("updated")
		const document = await documentOf(home, "base")
		const levies = document["levies"] as { id: string; due: string }[]
		expect(levies.map((levy) => levy.id)).toEqual(["th-2026-pit"])
		expect(levies[0]?.due).toBe("tax.net_payable")
		const flows = document["flows"] as { id: string; label?: string }[]
		expect(flows.find((flow) => flow.id === "salary")?.label).toBe("income.section40_1")
		expect(flows.find((flow) => flow.id === "rent")?.label).toBeUndefined()

		const run = await projection(home, ["run", "--scenario", "base", ...YEAR_FLAGS])
		expect(run.code).toBe(0)
		const body = runBody(run)
		expect(body.tax).toBe("applied")
		expect(body.notes[0]).toContain("Tax is applied: Thailand 2026 personal income tax")
		expect(body.scenario.contentHash).toBe(saved.scenario.contentHash)
	})

	it("charges exactly the tax the labelled Flows owe", async () => {
		const home = await projectionHome()
		const before = await projection(home, ["run", "--scenario", "base", ...YEAR_FLAGS])
		expect(before.code).toBe(0)
		expect(
			(await tax(home, ["base", "--tax", "th-2026", "--label", "salary=income.section40_1"])).code,
		).toBe(0)
		const after = await projection(home, ["run", "--scenario", "base", ...YEAR_FLAGS])
		expect(after.code).toBe(0)
		// 9 months of 80,000 THB salary in 2026, less the 100,000 expense cap and 60,000 personal
		// allowance, is 560,000 taxable: 7,500 + 20,000 + 9,000 = 36,500 THB, settled March 2027.
		expect(Number(lastClosing(before)) - Number(lastClosing(after))).toBeCloseTo(36_500, 2)
	})

	it("removes the Levy and its labels, so the figures are pre-tax again", async () => {
		const home = await projectionHome()
		await tax(home, ["base", "--tax", "th-2026", "--label", "salary=income.section40_1"])
		const removed = await tax(home, ["base", "--none"])
		expect(removed.code).toBe(0)
		expect((JSON.parse(removed.out) as { status: string }).status).toBe("updated")
		const document = await documentOf(home, "base")
		expect(document["levies"]).toBeUndefined()
		const flows = document["flows"] as { id: string; label?: string }[]
		expect(flows.find((flow) => flow.id === "salary")?.label).toBeUndefined()
		const run = await projection(home, ["run", "--scenario", "base", ...YEAR_FLAGS])
		expect(runBody(run).tax).toBe("not_applied")
		expect(runBody(run).notes[0]).toContain("No tax is applied")
	})

	it("refuses income Flows with no label tax-core reads, instead of taxing them as zero", async () => {
		const home = await projectionHome()
		const res = await tax(home, ["base", "--tax", "th-2026"])
		expect(res.code).toBe(2)
		const error = errorOf(res)
		expect(error.code).toBe("invalid_input")
		expect(error.path).toBe("document")
		const details = error.details as { flows: string[]; labels: string[] }
		expect(details.flows).toEqual(["salary"])
		expect(details.labels).toContain("income.section40_1")
	})

	it("refuses a label for a Flow the Scenario does not declare", async () => {
		const home = await projectionHome()
		const res = await tax(home, ["base", "--tax", "th-2026", "--label", "bonus=income.section40_1"])
		expect(res.code).toBe(2)
		expect(errorOf(res).path).toBe("label")
		expect(errorOf(res).message).toContain('"bonus"')
	})

	it("refuses a retirement allowance label on an income Flow", async () => {
		const home = await projectionHome()
		const res = await tax(home, [
			"base",
			"--tax",
			"th-2026",
			"--label",
			"salary=allowance.retirement.rmf",
		])
		expect(res.code).toBe(2)
		expect(errorOf(res).path).toBe("label")
		expect(errorOf(res).message).toContain("income Flow")
	})

	it("refuses --label as a bare word", async () => {
		const home = await projectionHome()
		const res = await tax(home, ["base", "--tax", "th-2026", "--label", "salary"])
		expect(res.code).toBe(2)
		expect(errorOf(res).message).toContain("<flow>=<label>")
	})

	it("refuses a profile flag without --tax, and --none with --label", async () => {
		const home = await projectionHome()
		const profile = await tax(home, ["base", "--filing-status", "single"])
		expect(profile.code).toBe(2)
		expect(errorOf(profile).path).toBe("filingStatus")
		expect(errorOf(profile).message).toContain("needs --tax")

		const both = await tax(home, ["base", "--none", "--label", "salary=income.section40_1"])
		expect(both.code).toBe(2)
		expect(errorOf(both).path).toBe("label")
	})

	it("refuses more 2018-or-later children than children", async () => {
		const home = await projectionHome()
		const res = await tax(home, [
			"base",
			"--tax",
			"th-2026",
			"--children",
			"1",
			"--children-at-higher-rate",
			"2",
		])
		expect(res.code).toBe(2)
		expect(errorOf(res).path).toBe("childrenAtHigherRate")
	})

	it("replaces an existing tax Levy rather than stacking a second one", async () => {
		const home = await projectionHome()
		await tax(home, [
			"base",
			"--tax",
			"th-2026",
			"--filing-status",
			"single",
			"--label",
			"salary=income.section40_1",
		])
		const again = await tax(home, [
			"base",
			"--tax",
			"th-2026",
			"--label",
			"salary=income.section40_1",
		])
		expect(again.code).toBe(0)
		const document = await documentOf(home, "base")
		expect((document["levies"] as unknown[]).length).toBe(1)
		// The same flags write the same document, so the second write is a no-op (ADR-0021).
		expect((JSON.parse(again.out) as { status: string }).status).toBe("unchanged")
	})

	it("reports a mixed compare when only one side carries the tax", async () => {
		const home = await projectionHome()
		expect((await scenario(home, ["fork", "base", "plain"])).code).toBe(0)
		await tax(home, ["base", "--tax", "th-2026", "--label", "salary=income.section40_1"])
		const res = await projection(home, ["compare", "base", "plain", ...YEAR_FLAGS])
		expect(res.code).toBe(0)
		const body = runBody(res)
		expect(body.tax).toBe("mixed")
		expect(body.notes[0]).toContain("Only A is taxed")
	})

	it("reports not_found for a Scenario that does not exist", async () => {
		const home = await seededHome()
		const applied = await applyScenario(home, "only", SIM_SCENARIO)
		expect(applied.code).toBe(0)
		const res = await tax(home, ["missing", "--tax", "th-2026"])
		expect(res.code).toBe(4)
		expect(errorOf(res).code).toBe("not_found")
	})
})
