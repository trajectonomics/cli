import { describe, expect, it } from "bun:test"
import { AS_OF, dateFlags, errorOf, projection, projectionHome } from "./projection/testing"
import { capture } from "./test-support"

type Figure = { age: number; nominal: string | null; real: string | null }

type Side = {
	scenario: { name: string; contentHash: string; effectiveContentHash: string }
	overrides: { path: string; value: unknown }[]
	fi: { reachable: boolean; fiDate?: string }
	runOut: { date: string; unmet: string } | null
	netWorth: {
		final: { date: string; nominal: string; real: string }
		atAges: Figure[]
	}
}

type CompareBody = {
	asOf: string
	horizon: string
	currency: string
	birthDate: string | null
	sides: { a: Side; b: Side }
	deltas: {
		fiMonths: number | null
		runOutYears: number | null
		netWorth: { nominal: string; real: string }
		atAges: Figure[]
	}
	tax: string
	notes: string[]
}

function bodyOf(res: { out: string }): CompareBody {
	return JSON.parse(res.out) as CompareBody
}

/** The three fields a what-if and a persisted fork state differently. */
function withoutScenarioIdentity(side: Side): Omit<Side, "scenario" | "overrides"> {
	const { scenario: _scenario, overrides: _overrides, ...rest } = side
	return rest
}

describe("projection compare", () => {
	it("matches compare A --set against comparing A with a fork made the same way", async () => {
		const home = await projectionHome()
		const sets = ["--set", "flows.salary.amount=12000000"]
		const whatIf = bodyOf(await projection(home, ["compare", "base", ...dateFlags(), ...sets]))
		const forked = await capture(["scenario", "fork", "base", "raised", ...sets, "--json"], {
			TRAJ_HOME: home,
		})
		expect(forked.code).toBe(0)
		const stored = bodyOf(await projection(home, ["compare", "base", "raised", ...dateFlags()]))
		expect(withoutScenarioIdentity(whatIf.sides.b)).toEqual(withoutScenarioIdentity(stored.sides.b))
		expect(whatIf.sides.a).toEqual(stored.sides.a)
		expect(whatIf.deltas).toEqual(stored.deltas)
		// A what-if states the Overrides it applied; a stored fork already holds them.
		expect(whatIf.sides.b.overrides).toEqual([{ path: "flows.salary.amount", value: 12000000 }])
		expect(stored.sides.b.overrides).toEqual([])
		expect(whatIf.sides.b.scenario.effectiveContentHash).toBe(stored.sides.b.scenario.contentHash)
	})

	it("reports deltas second minus first: FI months, net worth and run-out years", async () => {
		const home = await projectionHome()
		const body = bodyOf(await projection(home, ["compare", "base", "unreachable", ...dateFlags()]))
		expect(body.sides.a.fi).toMatchObject({ reachable: true, fiDate: "2026-04-01" })
		expect(body.sides.b.fi.reachable).toBe(false)
		// One side reaches FI, so the FI delta has no meaning and is null (ADR-0030).
		expect(body.deltas.fiMonths).toBeNull()
		// Only the unreachable plan runs out, so the run-out year delta has no meaning either.
		expect(body.sides.a.runOut).toBeNull()
		expect(body.sides.b.runOut).not.toBeNull()
		expect(body.deltas.runOutYears).toBeNull()
		expect(body.deltas.netWorth.nominal).toMatch(/^-?[0-9]+\.[0-9]{2}$/)
	})

	it("delta fiMonths counts whole calendar months between two FI dates", async () => {
		const home = await projectionHome()
		const body = bodyOf(await projection(home, ["compare", "base", "unreachable", ...dateFlags()]))
		const reachable = body.sides.a.fi.fiDate
		expect(reachable).toBe("2026-04-01")
		// A later FI date on the second side, made by an expense raise, moves the delta by months.
		const later = bodyOf(
			await projection(home, [
				"compare",
				"base",
				"--as-of",
				AS_OF,
				"--horizon",
				"2028-03-30",
				"--set",
				"flows.rent.amount=6000000",
			]),
		)
		expect(later.sides.a.fi).toMatchObject({ reachable: true, fiDate: "2026-06-01" })
		expect(later.sides.b.fi).toMatchObject({ reachable: true, fiDate: "2027-06-01" })
		expect(later.deltas.fiMonths).toBe(12)
	})

	it("reports net worth at each age, and null outside the Projection", async () => {
		const home = await projectionHome()
		const body = bodyOf(
			await projection(home, [
				"compare",
				"base",
				"--as-of",
				AS_OF,
				"--horizon",
				"2028-03-30",
				"--set",
				"flows.rent.amount=3000000",
				"--birth-date",
				"1985-06-15",
				"--age",
				"41",
				"--age",
				"60",
			]),
		)
		expect(body.birthDate).toBe("1985-06-15")
		expect(body.sides.a.netWorth.atAges.map((figure) => figure.age)).toEqual([41, 60])
		expect(body.sides.a.netWorth.atAges[0]?.nominal).toMatch(/^[0-9]+\.[0-9]{2}$/)
		// Age 60 is 2045: past the horizon, so the figure has no meaning and is null.
		expect(body.sides.a.netWorth.atAges[1]).toEqual({ age: 60, nominal: null, real: null })
		expect(body.deltas.atAges[1]).toEqual({ age: 60, nominal: null, real: null })
		// The final net worth at the horizon is always reported.
		expect(body.sides.a.netWorth.final.date).toBe("2028-03-30")
		expect(body.deltas.netWorth.nominal).toBeDefined()
	})

	it("refuses both or neither of a second Scenario and --set", async () => {
		const home = await projectionHome()
		const both = await projection(home, [
			"compare",
			"base",
			"unreachable",
			...dateFlags(),
			"--set",
			"flows.rent.amount=1",
		])
		expect(both.code).toBe(2)
		expect(errorOf(both)).toMatchObject({ code: "invalid_input", path: "b" })
		const neither = await projection(home, ["compare", "base", ...dateFlags()])
		expect(neither.code).toBe(2)
		expect(errorOf(neither)).toMatchObject({ code: "invalid_input", path: "b" })
	})

	it("needs --birth-date for --age, and a real one", async () => {
		const home = await projectionHome()
		const noBirth = await projection(home, [
			"compare",
			"base",
			...dateFlags(),
			"--set",
			"flows.rent.amount=1",
			"--age",
			"45",
		])
		expect(noBirth.code).toBe(2)
		expect(errorOf(noBirth)).toMatchObject({ code: "invalid_input", path: "age" })
		const badBirth = await projection(home, [
			"compare",
			"base",
			...dateFlags(),
			"--set",
			"flows.rent.amount=1",
			"--birth-date",
			"1985-02-30",
			"--age",
			"45",
		])
		expect(badBirth.code).toBe(3)
		expect(errorOf(badBirth)).toMatchObject({ code: "INVALID_DATE", path: "birthDate" })
	})

	it("names the side it could not find", async () => {
		const home = await projectionHome()
		const res = await projection(home, ["compare", "base", "nope", ...dateFlags()])
		expect(res.code).toBe(4)
		expect(errorOf(res)).toMatchObject({ code: "not_found", path: "b" })
	})

	it("gives identical bytes twice and names the tax status", async () => {
		const home = await projectionHome()
		const flags = ["compare", "base", "unreachable", ...dateFlags()]
		const once = await projection(home, flags)
		const twice = await projection(home, flags)
		expect(twice.out).toBe(once.out)
		expect(bodyOf(once).tax).toBe("not_applied")
		expect(bodyOf(once).notes[0]).toContain("No tax is applied")
	})

	it("describes its input and result in `traj schema`", async () => {
		const res = await capture(["schema", "projection", "compare", "--json"])
		expect(res.code).toBe(0)
		const data = JSON.parse(res.out)
		expect(data.name).toBe("projection compare")
		expect(data.positionals).toEqual(["a", "b"])
		expect(Object.keys(data.input.properties).sort()).toEqual([
			"a",
			"age",
			"asOf",
			"b",
			"birthDate",
			"horizon",
			"set",
		])
		expect([...data.input.required].sort()).toEqual(["a", "asOf", "horizon"])
	})
})
