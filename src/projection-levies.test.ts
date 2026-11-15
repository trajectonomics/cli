import { describe, expect, it } from "bun:test"
import { errorOf, fi, projection, projectionHome } from "./projection/testing"
import { runBody } from "./projection-run-support"
import { scenario } from "./scenario-test-support"

/** A Scenario of the fixture plan with the salary taxed as Section 40(1) income. */
async function taxedHome(): Promise<string> {
	const home = await projectionHome()
	const applied = await scenario(home, [
		"tax",
		"base",
		"--tax",
		"th-2026",
		"--label",
		"salary=income.section40_1",
	])
	if (applied.code !== 0) throw new Error(applied.err)
	return home
}

describe("a taxed Projection", () => {
	it("fills the Carry-in the As-of implies, and says the earlier tax is not recomputed", async () => {
		const home = await taxedHome()
		// The tax year starts the same day, so the Projection is charged for the whole of 2026; the
		// previous year's Settlement still falls inside it, and the CLI states what that means.
		const res = await projection(home, [
			"run",
			"--scenario",
			"base",
			"--as-of",
			"2026-01-01",
			"--horizon",
			"2027-12-31",
		])
		expect(res.code).toBe(0)
		const notes = runBody(res).notes
		expect(notes.join(" ")).toContain("Tax before 2026 is not recomputed")
		expect(notes.join(" ")).not.toContain("not the whole year")
	})

	it("says when the first tax year is charged on part of the year", async () => {
		const home = await taxedHome()
		const res = await projection(home, [
			"run",
			"--scenario",
			"base",
			"--as-of",
			"2026-06-01",
			"--horizon",
			"2027-12-31",
		])
		expect(res.code).toBe(0)
		const notes = runBody(res).notes
		expect(notes.join(" ")).toContain(
			"The 2026 tax year is charged on the Flows from 2026-06-01, not the whole year.",
		)
	})

	it("leaves a Levy the caller wrote alone, and the engine refuses it when it needs a Carry-in", async () => {
		const home = await projectionHome()
		// The fixture "levied" Scenario states its own Levy and Carry-in, so nothing is injected...
		expect(
			(
				await projection(home, [
					"run",
					"--scenario",
					"levied",
					"--as-of",
					"2026-03-31",
					"--horizon",
					"2027-03-30",
				])
			).code,
		).toBe(0)
		// ...and the tax the CLI did not emit is not reported as applied.
		const body = runBody(
			await projection(home, [
				"run",
				"--scenario",
				"levied",
				"--as-of",
				"2026-03-31",
				"--horizon",
				"2027-03-30",
			]),
		)
		expect(body.tax).toBe("not_applied")
	})

	it("refuses a Levy the CLI did not emit when the Timeline needs a Carry-in", async () => {
		const home = await projectionHome()
		// A caller's own Levy with no Carry-in is the caller's to state: the engine refuses it, and
		// the CLI does not invent "nothing was tallied before the As-of" (ADR-0032).
		const document = {
			...JSON.parse((await scenario(home, ["show", "levied"])).out).scenario.document,
		}
		const levies = (document.levies as Record<string, unknown>[]).map(
			({ carryIn: _carryIn, ...levy }) => ({ ...levy, id: "national" }),
		)
		const applied = await scenario(
			home,
			["apply", "own-levy", "--file", "-"],
			JSON.stringify({ ...document, levies }),
		)
		expect(applied.code).toBe(0)
		const res = await projection(home, [
			"run",
			"--scenario",
			"own-levy",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2027-03-30",
		])
		expect(res.code).toBe(3)
		expect(errorOf(res).details).toMatchObject([{ code: "MISSING_CARRY_IN" }])
	})

	it("applies the same tax to the FI date", async () => {
		const home = await taxedHome()
		const res = await fi(home, [
			"--scenario",
			"base",
			"--as-of",
			"2026-01-01",
			"--horizon",
			"2060-12-31",
		])
		expect(res.code).toBe(0)
		expect(runBody(res).tax).toBe("applied")
	})
})
