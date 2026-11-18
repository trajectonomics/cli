import { describe, expect, it } from "bun:test"
import { errorOf, projectionHome } from "./projection/testing"
import type { ScenarioBody } from "./scenario-test-support"
import { applyScenario, rowOf, scenario } from "./scenario-test-support"
import type { Captured } from "./test-support"

/** `traj scenario tax ...` in JSON against one data directory. */
function tax(home: string, argv: readonly string[]): Promise<Captured> {
	return scenario(home, ["tax", ...argv])
}

/** The document a Scenario write returned. */
function documentOf(data: ReturnType<typeof JSON.parse>): Record<string, unknown> {
	return (rowOf(data) as ScenarioBody).document
}

describe("scenario tax refusals", () => {
	it("refuses an allowance flag without --tax, naming the flag", async () => {
		const home = await projectionHome()
		const res = await tax(home, ["base", "--mortgage-interest", "30000"])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "--mortgage-interest" })
	})

	it("refuses --none beside an allowance flag", async () => {
		const home = await projectionHome()
		const res = await tax(home, ["base", "--none", "--social-security", "9000"])
		expect(res.code).toBe(2)
		expect(errorOf(res).path).toBe("--none")
	})

	it("lists the filing statuses a bad --filing-status could have used", async () => {
		const home = await projectionHome()
		const res = await tax(home, ["base", "--tax", "th-2026", "--filing-status", "single-ish"])
		expect(res.code).toBe(2)
		const error = errorOf(res)
		expect(error.path).toBe("--filing-status")
		expect(error.message).toContain("married_no_income_spouse")
		expect(error.message).toContain("married_joint")
	})

	it("lists the jurisdictions a bad --tax could have used", async () => {
		const home = await projectionHome()
		const res = await tax(home, [
			"base",
			"--tax",
			"th-2027",
			"--label",
			"salary=income.section40_1",
		])
		expect(res.code).toBe(2)
		expect(errorOf(res).message).toContain("th-2026")
	})

	it("removes the Prepayments that named the removed Levy, so --none is legal", async () => {
		const home = await projectionHome()
		const applied = await tax(home, [
			"base",
			"--tax",
			"th-2026",
			"--label",
			"salary=income.section40_1",
		])
		expect(applied.code).toBe(0)
		// 3% taken at source names the Levy, so removing the Levy without the Prepayment would
		// leave the engine's LEVY_REQUIRED behind for the next read.
		const document = documentOf(JSON.parse(applied.out))
		const flows = document["flows"] as Record<string, unknown>[]
		const salary = flows.find((flow) => flow["id"] === "salary")
		if (salary === undefined) throw new Error("the fixture has no salary Flow")
		salary["prepayments"] = [{ levy: "th-2026-pit", bps: 300 }]
		const prepaid = await applyScenario(home, "base", document)
		expect(prepaid.code).toBe(0)

		const removed = await tax(home, ["base", "--none"])
		expect(removed.code).toBe(0)
		const after = documentOf(JSON.parse(removed.out))
		expect(after["levies"]).toBeUndefined()
		const afterSalary = (after["flows"] as Record<string, unknown>[]).find(
			(flow) => flow["id"] === "salary",
		)
		expect(afterSalary?.["prepayments"]).toBeUndefined()
		expect(afterSalary?.["label"]).toBeUndefined()
	})
})
