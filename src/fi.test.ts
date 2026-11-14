import { describe, expect, it } from "bun:test"
import simPackage from "@trajectonomics/sim/package.json"
import type { FiView } from "./projection/fi-view"
import { AS_OF, baseFlags, errorOf, fi, HORIZON, projectionHome } from "./projection/testing"
import { type Captured, capture } from "./test-support"

function bodyOf(res: Captured): FiView {
	return JSON.parse(res.out) as FiView
}

describe("fi", () => {
	it("reports the hand-computed survival FI date on the fixture Ledger", async () => {
		// The fixture's Baseline is THB 953,449.51 at 2026-03-31 and the Scenario's expenses are
		// 25,000 a month growing with 2.5% inflation: 300,000 for the year, well inside the assets.
		// So earned income could stop at the first month after the As-of, and it never runs out.
		const home = await projectionHome()
		const res = await fi(home, baseFlags())
		expect(res.code).toBe(0)
		const body = bodyOf(res)
		expect(body.asOf).toBe(AS_OF)
		expect(body.horizon).toBe(HORIZON)
		expect(body.engine).toEqual({ package: "@trajectonomics/sim", version: simPackage.version })
		expect(body.method).toBe("survival")
		expect(body.definition).toEqual({ method: "survival", definitionVersion: 1 })
		expect(body.fi).toMatchObject({ reachable: true, fiDate: "2026-04-01" })
	})

	it("puts the 25x rule of thumb beside the date, labelled as a reference", async () => {
		const home = await projectionHome()
		const body = bodyOf(await fi(home, baseFlags()))
		if (!body.fi.reachable) throw new Error("the fixture is expected to reach FI")
		expect(body.fi.reference).toMatchObject({
			label: "ruleOfThumb",
			date: "2026-04-01",
			multiplier: 25,
			annualExpenses: "300000.00",
			threshold: "7500000.00",
			met: false,
		})
		// The reference is a comparison, not a decision: it says the portfolio is short of the
		// 25x figure while the survival test still reaches FI.
		expect(body.fi.fiDate).toBe("2026-04-01")
	})

	it("reports the binding constraint and the best case when FI is unreachable", async () => {
		const home = await projectionHome()
		const res = await fi(home, baseFlags("unreachable"))
		expect(res.code).toBe(0)
		const body = bodyOf(res)
		expect(body.fi).toMatchObject({
			reachable: false,
			binding: "shortfallBeforeStop",
			bestCase: { month: "2026-05-01", runsOut: { date: "2026-04-01" } },
		})
	})

	it("reports noCandidateMonth when the horizon leaves no month to stop in", async () => {
		const home = await projectionHome()
		const res = await fi(home, ["--scenario", "base", "--as-of", AS_OF, "--horizon", AS_OF])
		expect(res.code).toBe(0)
		expect(bodyOf(res).fi).toEqual({ reachable: false, binding: "noCandidateMonth" })
	})

	it("never lets the reference change the FI date", async () => {
		const home = await projectionHome()
		const plain = bodyOf(await fi(home, baseFlags()))
		const raised = bodyOf(await fi(home, [...baseFlags(), "--set", "flows.salary.amount=20000000"]))
		if (!plain.fi.reachable || !raised.fi.reachable) throw new Error("expected two FI dates")
		expect(raised.fi.fiDate).toBe(plain.fi.fiDate)
		expect(raised.fi.reference.threshold).toBe(plain.fi.reference.threshold)
	})

	it("gives identical bytes twice, in JSON and in the human format", async () => {
		const home = await projectionHome()
		const once = await fi(home, baseFlags())
		const twice = await fi(home, baseFlags())
		expect(twice.out).toBe(once.out)
		const flags = ["fi", ...baseFlags()]
		const humanOnce = await capture(flags, { TRAJ_HOME: home })
		const humanTwice = await capture(flags, { TRAJ_HOME: home })
		expect(humanOnce.code).toBe(0)
		expect(humanTwice.out).toBe(humanOnce.out)
		expect(humanOnce.out).toContain("fiDate: 2026-04-01")
		expect(humanOnce.out).toContain("tax: not_applied")
	})

	it("echoes the Scenario, the Overrides and the tax status like projection run", async () => {
		const home = await projectionHome()
		const body = bodyOf(await fi(home, [...baseFlags(), "--set", "flows.rent.amount=3000000"]))
		expect(body.scenario.name).toBe("base")
		expect(body.scenario.effectiveContentHash).not.toBe(body.scenario.contentHash)
		expect(body.overrides).toEqual([{ path: "flows.rent.amount", value: 3000000 }])
		expect(body.tax).toBe("not_applied")
		expect(body.notes[0]).toContain("No tax is applied")
	})

	it("fails the same ways projection run does", async () => {
		const home = await projectionHome()
		const missing = await fi(home, baseFlags("nope"))
		expect(missing.code).toBe(4)
		expect(errorOf(missing).code).toBe("not_found")
		const usd = await fi(home, baseFlags("usd"))
		expect(usd.code).toBe(3)
		expect(errorOf(usd).code).toBe("unsupported_currency")
		const refused = await fi(home, [...baseFlags(), "--set", "flows.salery.amount=1"])
		expect(refused.code).toBe(2)
		expect(errorOf(refused).code).toBe("invalid_input")
	})

	it("describes its input and result in `traj schema`", async () => {
		const res = await capture(["schema", "fi", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.name).toBe("fi")
		expect(data.positionals).toEqual([])
		expect(Object.keys(data.input.properties).sort()).toEqual([
			"asOf",
			"horizon",
			"scenario",
			"set",
		])
		expect(data.output.properties.fi.anyOf).toHaveLength(3)
		expect(data.errorCodes).toContain("projection_refused")
	})
})
