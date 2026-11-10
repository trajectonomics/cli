import { describe, expect, it } from "bun:test"
import {
	applyScenario,
	errorOf,
	resultOf,
	rowOf,
	scenario,
	scenarioHome,
} from "./scenario-test-support"

const STREAMS = {
	schemaVersion: 1,
	streams: [
		{ id: "salary", amount: 40_000 },
		{ id: "bonus", amount: 5_000 },
	],
	goal: { amount: 1_000_000 },
}

type OverrideBody = { path: string; value: unknown }

function overridesOf(data: unknown): OverrideBody[] {
	return (data as { overrides: OverrideBody[] }).overrides
}

describe("scenario fork --set paths", () => {
	it("addresses a list item by its id, never by index", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", STREAMS)
		const byId = await scenario(home, ["fork", "base", "by-id", "--set", "streams.salary.amount=1"])
		expect(byId.code).toBe(0)
		const byIndex = await scenario(home, [
			"fork",
			"base",
			"by-index",
			"--set",
			"streams.0.amount=1",
		])
		expect(byIndex.code).toBe(2)
		expect(errorOf(byIndex).details).toMatchObject({ segment: "0" })
	})

	it("addresses a numeric-looking id as an id", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", { schemaVersion: 1, items: [{ id: "0", v: 1 }] })
		const res = await scenario(home, ["fork", "base", "zero", "--set", "items.0.v=2"])
		expect(res.code).toBe(0)
		expect(rowOf(resultOf(res)).document).toEqual({
			schemaVersion: 1,
			items: [{ id: "0", v: 2 }],
		})
	})

	it("refuses a change to a list item's id", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", STREAMS)
		const res = await scenario(home, [
			"fork",
			"base",
			"early",
			"--set",
			'streams.salary={"id":"other","amount":1}',
		])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ path: "set", details: { segment: "salary" } })
		const kept = await scenario(home, [
			"fork",
			"base",
			"kept",
			"--set",
			'streams.salary={"id":"salary","amount":1}',
		])
		expect(kept.code).toBe(0)
	})

	it("refuses an ambiguous id and a new key", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", {
			schemaVersion: 1,
			list: [
				{ id: "a", v: 1 },
				{ id: "a", v: 2 },
			],
		})
		const ambiguous = await scenario(home, ["fork", "base", "dup", "--set", "list.a.v=3"])
		expect(ambiguous.code).toBe(2)
		expect(errorOf(ambiguous).code).toBe("invalid_input")
		const added = await scenario(home, ["fork", "base", "new-key", "--set", "money=1"])
		expect(added.code).toBe(2)
		expect(errorOf(added).code).toBe("invalid_input")
	})

	it("refuses walking into a scalar", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", STREAMS)
		const res = await scenario(home, ["fork", "base", "early", "--set", "goal.amount.value=1"])
		expect(res.code).toBe(2)
		expect(errorOf(res).details).toMatchObject({ segment: "goal.amount" })
	})

	it("reports a document the overrides leave invalid at the set field", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", STREAMS)
		const res = await scenario(home, ["fork", "base", "early", "--set", "schemaVersion=0"])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({
			code: "invalid_input",
			path: "set",
			details: { index: 0, path: "schemaVersion", documentPath: "document.schemaVersion" },
		})
	})

	it("echoes the canonical, escaped path", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", { schemaVersion: 1, "a.b": { "c=d": 1 } })
		const res = await scenario(home, ["fork", "base", "early", "--set", "a\\.b.c\\=d=2"])
		expect(res.code).toBe(0)
		expect(overridesOf(resultOf(res))).toEqual([{ path: "a\\.b.c\\=d", value: 2 }])
	})
})
