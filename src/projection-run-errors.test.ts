import { describe, expect, it } from "bun:test"
import { edited } from "./baseline/testing"
import {
	AS_OF,
	baseFlags,
	errorOf,
	HORIZON,
	leviedScenario,
	projection,
	projectionHome,
	seededHome,
} from "./projection/testing"
import { PERSONAL_ENTITY_ID } from "./store"
import { mustOpen, SCENARIO_DOCUMENT } from "./store/testing"
import { capture } from "./test-support"

describe("projection run failures", () => {
	it("fails a --set typo with the same hint scenario fork --set gives", async () => {
		const home = await projectionHome()
		const res = await projection(home, ["run", ...baseFlags(), "--set", "flows.salery.amount=1"])
		expect(res.code).toBe(2)
		const error = errorOf(res)
		expect(error).toMatchObject({
			code: "invalid_input",
			path: "set",
			hint: 'Did you mean "flows.salary.amount"?',
		})
		expect(error.details).toMatchObject({ index: 0, segment: "salery" })
	})

	it("refuses what the engine refuses as projection_refused, with its codes and paths", async () => {
		const home = seededHome()
		await capture(
			["scenario", "apply", "small", "--file", "-", "--json"],
			{ TRAJ_HOME: home },
			undefined,
			JSON.stringify(SCENARIO_DOCUMENT),
		)
		const res = await projection(home, ["run", ...baseFlags("small")])
		expect(res.code).toBe(3)
		const error = errorOf(res)
		expect(error.code).toBe("projection_refused")
		expect(error.exitCode).toBe(3)
		expect(error.path).toBe("baseline.balances.0.account")
		const details = error.details as { code: string; path: string }[]
		expect(details.every((detail) => detail.code === "UNDECLARED_BALANCE_ACCOUNT")).toBe(true)
		expect(details.map((detail) => detail.path)).toEqual([
			"baseline.balances.0.account",
			"baseline.balances.1.account",
			"baseline.balances.2.account",
			"baseline.balances.3.account",
			"baseline.balances.4.account",
			"baseline.balances.5.account",
		])
	})

	it("refuses a stored v1 Scenario at projection_refused and never migrates it (ADR-0031)", async () => {
		const home = await projectionHome()
		mustOpen(home).close()
		const v1 =
			'{"accounts":[],"cashflow":{"surplus":[],"withdraw":[]},"currency":"THB","economy":{"inflation":0},"flows":[],"schemaVersion":1}'
		edited(
			home,
			`INSERT INTO scenario (id, entity_id, name, document, content_hash, forked_from, version, created_at, updated_at)
			VALUES ('0194e000-0002-7000-8000-000000000002', '${PERSONAL_ENTITY_ID}', 'old', '${v1}',
			'jcs1:sha256:0', NULL, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
		)
		const res = await projection(home, ["run", ...baseFlags("old")])
		expect(res.code).toBe(3)
		expect(errorOf(res)).toMatchObject({
			code: "projection_refused",
			path: "scenario.schemaVersion",
			details: [{ code: "UNSUPPORTED_SCHEMA_VERSION", path: "scenario.schemaVersion" }],
		})
		// The row is untouched: `scenario show` still prints it.
		const shown = await capture(["scenario", "show", "old", "--json"], { TRAJ_HOME: home })
		expect(shown.code).toBe(0)
		expect(JSON.parse(shown.out).scenario.document.schemaVersion).toBe(1)
	})

	it("projects a levied Scenario, and refuses one whose Carry-in the Timeline needs", async () => {
		const home = await projectionHome()
		expect((await projection(home, ["run", ...baseFlags("levied")])).code).toBe(0)
		// The Levy's period began before the As-of, so the engine needs a carry-in; without one the
		// projection is refused with the engine's own code at the field (ADR-0024).
		const { levies = [] } = leviedScenario()
		const without = {
			...leviedScenario(),
			levies: levies.map(({ carryIn: _carryIn, ...levy }) => levy),
		}
		await capture(
			["scenario", "apply", "no-carry", "--file", "-", "--json"],
			{ TRAJ_HOME: home },
			undefined,
			JSON.stringify(without),
		)
		const res = await projection(home, ["run", ...baseFlags("no-carry")])
		expect(res.code).toBe(3)
		expect(errorOf(res)).toMatchObject({
			code: "projection_refused",
			path: "scenario.levies.0.carryIn",
			details: [{ code: "MISSING_CARRY_IN", path: "scenario.levies.0.carryIn" }],
		})
	})

	it("reports a Timeline problem at the flag that caused it, as invalid_input", async () => {
		const home = await projectionHome()
		for (const [horizon, code] of [
			["2026-01-01", "HORIZON_BEFORE_START"],
			["2026-02-30", "INVALID_DATE"],
		] as const) {
			const res = await projection(home, [
				"run",
				"--scenario",
				"base",
				"--as-of",
				AS_OF,
				"--horizon",
				horizon,
			])
			expect(res.code).toBe(2)
			expect(errorOf(res)).toMatchObject({
				code: "invalid_input",
				path: "horizon",
				details: [{ code, path: "timeline.horizon" }],
			})
		}
	})

	it("names an unknown Scenario as not_found at exit 4", async () => {
		const home = await projectionHome()
		const res = await projection(home, ["run", ...baseFlags("nope")])
		expect(res.code).toBe(4)
		expect(errorOf(res)).toMatchObject({
			code: "not_found",
			path: "scenario",
			details: { resource: "scenario" },
		})
	})

	it("refuses a Scenario whose currency is not THB", async () => {
		const home = await projectionHome()
		const res = await projection(home, ["run", ...baseFlags("usd")])
		expect(res.code).toBe(3)
		expect(errorOf(res)).toMatchObject({
			code: "unsupported_currency",
			path: "scenario.currency",
			details: { supported: ["THB"], actual: "USD" },
		})
	})

	it("checks the As-of before it reads the Ledger (ADR-0029)", async () => {
		const home = await projectionHome()
		const res = await projection(home, [
			"run",
			"--scenario",
			"base",
			"--as-of",
			"2026-02-30",
			"--horizon",
			HORIZON,
		])
		expect(res.code).toBe(3)
		expect(errorOf(res)).toMatchObject({ code: "INVALID_DATE", path: "asOf" })
	})
})
