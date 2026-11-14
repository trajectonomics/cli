import { describe, expect, it } from "bun:test"
import {
	applyScenario,
	errorOf,
	resultOf,
	rowOf,
	scenario,
	scenarioHome,
	summariesOf,
} from "./scenario-test-support"
import { SCENARIO_DOCUMENT } from "./store/testing"

const DOC = SCENARIO_DOCUMENT

type OverrideBody = { path: string; value: unknown }

function overridesOf(data: unknown): OverrideBody[] {
	return (data as { overrides: OverrideBody[] }).overrides
}

/** A whole-item replacement of the salary flow, as `--set` takes it. */
function salarySet(change: Record<string, unknown>): string {
	return `flows.salary=${JSON.stringify({ ...DOC.flows[0], ...change })}`
}

describe("scenario fork --set paths", () => {
	it("addresses a list item by its id, never by index", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const byId = await scenario(home, ["fork", "base", "by-id", "--set", "accounts.cash.rate=250"])
		expect(byId.code).toBe(0)
		const byIndex = await scenario(home, [
			"fork",
			"base",
			"by-index",
			"--set",
			"accounts.0.rate=250",
		])
		expect(byIndex.code).toBe(2)
		expect(errorOf(byIndex).details).toMatchObject({ segment: "0" })
	})

	it("addresses a numeric-looking id as an id", async () => {
		const home = scenarioHome()
		const document = {
			schemaVersion: 4,
			currency: "THB",
			economy: { inflation: 0 },
			accounts: [{ id: "0", kind: "asset", rate: 0 }],
			flows: [],
			cashflow: { surplus: [{ account: "0" }], contribute: [], withdraw: ["0"] },
		}
		await applyScenario(home, "base", document)
		const res = await scenario(home, ["fork", "base", "zero", "--set", "accounts.0.rate=100"])
		expect(res.code).toBe(0)
		expect(overridesOf(resultOf(res))).toEqual([{ path: "accounts.0.rate", value: 100 }])
		expect(rowOf(resultOf(res)).document).toMatchObject({
			accounts: [{ id: "0", kind: "asset", rate: 100 }],
		})
	})

	it("refuses changing an item's id field as well as its whole value", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		for (const set of ['flows.salary.id="bonus"', 'flows.salary.id="other"']) {
			const res = await scenario(home, ["fork", "base", "early", "--set", set])
			expect(res.code).toBe(2)
			expect(errorOf(res)).toMatchObject({ path: "set", details: { segment: "salary" } })
		}
		const names = summariesOf(resultOf(await scenario(home, ["list"]))).map(
			(summary) => summary.name,
		)
		expect(names).toEqual(["base"])
	})

	it("refuses a change to a list item's id", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const changed = await scenario(home, [
			"fork",
			"base",
			"early",
			"--set",
			salarySet({ id: "other", amount: 1 }),
		])
		expect(changed.code).toBe(2)
		expect(errorOf(changed)).toMatchObject({ path: "set", details: { segment: "salary" } })
		const kept = await scenario(home, ["fork", "base", "kept", "--set", salarySet({ amount: 1 })])
		expect(kept.code).toBe(0)
	})

	it("refuses a new key", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const res = await scenario(home, ["fork", "base", "new-key", "--set", "money=1"])
		expect(res.code).toBe(2)
		expect(errorOf(res).code).toBe("invalid_input")
	})

	it("refuses walking into a scalar", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const res = await scenario(home, [
			"fork",
			"base",
			"early",
			"--set",
			"economy.inflation.value=1",
		])
		expect(res.code).toBe(2)
		expect(errorOf(res).details).toMatchObject({ segment: "economy.inflation" })
	})

	it("reports a document the overrides leave invalid at the set field", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const res = await scenario(home, ["fork", "base", "early", "--set", "schemaVersion=0"])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({
			code: "invalid_input",
			path: "set",
			details: {
				index: 0,
				path: "schemaVersion",
				documentPath: "document.schemaVersion",
				code: "UNSUPPORTED_SCHEMA_VERSION",
			},
		})
	})

	it("attributes a problem under a whole-item replacement to that set", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const res = await scenario(home, [
			"fork",
			"base",
			"early",
			"--set",
			'flows.salary={"id":"salary"}',
		])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({
			code: "invalid_input",
			path: "set",
			details: {
				index: 0,
				path: "flows.salary",
				documentPath: "document.flows.0.kind",
				code: "MISSING_KEY",
			},
		})
	})
})
