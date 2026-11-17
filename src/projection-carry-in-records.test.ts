import { describe, expect, it } from "bun:test"
import { carryInFile, MID_PERIOD, taxedHome, thRecord } from "./projection/carry-in-support"
import { errorOf, projection, projectionHome } from "./projection/testing"
import { runBody } from "./projection-run-support"
import { scenario } from "./scenario-test-support"

describe("the records the flag states", () => {
	it("refuses a period this Projection does not need", async () => {
		const home = await taxedHome()
		// Both records are well formed; the second states 2025, whose Settlement falls before this
		// As-of, so it is not a period the Projection leaves open.
		const res = await projection(home, [
			"run",
			"--scenario",
			"base",
			...MID_PERIOD,
			"--carry-in",
			carryInFile(home, [thRecord(), thRecord({ periodStart: "2025-01-01" })]),
		])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({
			code: "invalid_input",
			path: "document.1.periodStart",
		})
		expect(errorOf(res).message).toContain("2025-01-01")
	})

	it("refuses a period stated twice, whichever source", async () => {
		const home = await projectionHome()
		const res = await projection(home, [
			"run",
			"--scenario",
			"levied",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2027-03-30",
			"--carry-in",
			carryInFile(home, [
				{
					scenario: "levied",
					levy: "national",
					periodStart: "2026-01-01",
					tallies: [{ label: "salary", basis: "gross", amount: "0.00" }],
					prepaid: "0.00",
				},
			]),
		])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "document.0.periodStart" })
		expect(errorOf(res).message).toContain("stated twice")
	})

	it("refuses a Levy, a Scenario and a class the pair does not hold", async () => {
		const home = await taxedHome()
		const cases: [unknown, string][] = [
			[thRecord({ levy: "nope" }), "document.0.levy"],
			[thRecord({ scenario: "elsewhere" }), "document.0.scenario"],
			[
				thRecord({
					rest: undefined,
					tallies: [{ label: "nope", basis: "gross", amount: "0.00" }],
				}),
				"document.0.tallies.0.label",
			],
		]
		for (const [record, path] of cases) {
			const res = await projection(home, [
				"run",
				"--scenario",
				"base",
				...MID_PERIOD,
				"--carry-in",
				carryInFile(home, [record]),
			])
			expect({ path, code: res.code, got: errorOf(res).path }).toEqual({
				path,
				code: 2,
				got: path,
			})
		}
	})

	it("refuses a flag with no Levy to state, and a rest that is not zero", async () => {
		const home = await projectionHome()
		const noLevy = await projection(home, [
			"run",
			"--scenario",
			"base",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2027-03-30",
			"--carry-in",
			carryInFile(home, [thRecord()]),
		])
		expect(noLevy.code).toBe(2)
		expect(errorOf(noLevy)).toMatchObject({ code: "invalid_input", path: "--carry-in" })
		const rest = await projection(home, [
			"run",
			"--scenario",
			"levied",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2027-03-30",
			"--carry-in",
			carryInFile(home, [
				{
					scenario: "levied",
					levy: "national",
					periodStart: "2026-01-01",
					tallies: [],
					prepaid: "0.00",
					rest: "10.00",
				},
			]),
		])
		expect(rest.code).toBe(2)
		expect(errorOf(rest)).toMatchObject({ code: "invalid_input", path: "document.0.rest" })
	})
})

describe("a stored Carry-in", () => {
	it("is echoed as the document's own, and follows the class rule", async () => {
		const home = await projectionHome()
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
		expect(body.carryIn).toEqual([
			{
				levy: "national",
				periodStart: "2026-01-01",
				tallies: [{ label: "salary", basis: "gross", amount: "0.00" }],
				prepaid: "0.00",
				source: "document",
			},
		])
	})
})

describe("a Scenario that declares a calendar", () => {
	it("places the caller's records as given, and derives nothing", async () => {
		const home = await taxedHome()
		const shown = JSON.parse((await scenario(home, ["show", "base"])).out).scenario.document
		const withCalendar = {
			...shown,
			calendar: { dayRule: "exact", holidays: [] },
		}
		const applied = await scenario(
			home,
			["apply", "cal", "--file", "-"],
			JSON.stringify(withCalendar),
		)
		expect(applied.code).toBe(0)
		const res = await projection(home, [
			"run",
			"--scenario",
			"cal",
			...MID_PERIOD,
			"--carry-in",
			carryInFile(home, [thRecord({ scenario: "cal" })]),
		])
		expect(res.code).toBe(0)
		// No scope record and no derived period: only the record the caller stated is placed.
		expect(runBody(res).carryIn?.map((it) => it.periodStart)).toEqual(["2026-01-01"])
		// A boundary start gets no scope record either, so the engine is the one that refuses the
		// period this build cannot vouch for: the CLI invents nothing on a calendar's behalf.
		const boundary = await projection(home, [
			"run",
			"--scenario",
			"cal",
			"--as-of",
			"2026-01-01",
			"--horizon",
			"2027-12-31",
		])
		expect(boundary.code).toBe(3)
		expect(errorOf(boundary)).toMatchObject({ code: "projection_refused" })
		expect(errorOf(boundary).details).toMatchObject([{ code: "MISSING_CARRY_IN" }])
	})
})
