import { describe, expect, it } from "bun:test"
import {
	applyScenario,
	errorOf,
	resultOf,
	rowOf,
	SCENARIO_DOCUMENT,
	scenario,
	scenarioHome,
	summariesOf,
} from "./scenario-test-support"

const DOC = SCENARIO_DOCUMENT

type OverrideBody = { path: string; value: unknown }

function overridesOf(data: unknown): OverrideBody[] {
	return (data as { overrides: OverrideBody[] }).overrides
}

describe("scenario fork --set", () => {
	it("changes only the fork's copy and echoes the applied override", async () => {
		const home = scenarioHome()
		const base = rowOf(resultOf(await applyScenario(home, "base", DOC)))
		const res = await scenario(home, [
			"fork",
			"base",
			"early",
			"--set",
			"flows.salary.amount=200000",
		])
		expect(res.code).toBe(0)
		const data = resultOf(res)
		expect(overridesOf(data)).toEqual([{ path: "flows.salary.amount", value: 200_000 }])
		const fork = rowOf(data)
		expect((fork.document as { flows: unknown[] }).flows).toContainEqual({
			...DOC.flows[0],
			amount: 200_000,
		})
		expect(rowOf(resultOf(await scenario(home, ["show", "base"]))).document).toEqual(base.document)
	})

	it("applies several sets in command-line order and echoes them in that order", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const res = await scenario(home, [
			"fork",
			"base",
			"early",
			"--set",
			"economy.inflation=100",
			"--set",
			"flows.bonus.amount=7000",
		])
		const data = resultOf(res)
		expect(overridesOf(data).map((override) => override.path)).toEqual([
			"economy.inflation",
			"flows.bonus.amount",
		])
		expect(rowOf(data).document).toMatchObject({
			economy: { inflation: 100 },
		})
	})

	it("refuses an exact duplicate path", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const res = await scenario(home, [
			"fork",
			"base",
			"early",
			"--set",
			"economy.inflation=1",
			"--set",
			"economy.inflation=2",
		])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({
			code: "invalid_input",
			path: "set",
			details: { path: "economy.inflation" },
		})
	})

	it("fails a typo with a did-you-mean hint and writes no fork", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const res = await scenario(home, ["fork", "base", "early", "--set", "flows.salery.amount=1"])
		expect(res.code).toBe(2)
		const error = errorOf(res)
		expect(error).toMatchObject({
			code: "invalid_input",
			path: "set",
			details: {
				index: 0,
				path: "flows.salery.amount",
				segment: "salery",
				suggestion: "flows.salary.amount",
			},
		})
		expect(error.hint).toContain("flows.salary.amount")
		const names = summariesOf(resultOf(await scenario(home, ["list"]))).map(
			(summary) => summary.name,
		)
		expect(names).toEqual(["base"])
	})

	it("lists known siblings when no candidate is close", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const res = await scenario(home, ["fork", "base", "early", "--set", "nothing.at.all=1"])
		expect(res.code).toBe(2)
		expect(errorOf(res).details).toMatchObject({ suggestion: null })
		expect(errorOf(res).hint).toContain("schemaVersion")
	})

	it("names the set that broke the document, not merely the last one", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const res = await scenario(home, [
			"fork",
			"base",
			"early",
			"--set",
			"schemaVersion=0",
			"--set",
			'economy.inflation="x"',
		])
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
		expect(summariesOf(resultOf(await scenario(home, ["list"]))).map((one) => one.name)).toEqual([
			"base",
		])
	})

	it("refuses a bare word with a quoting hint", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", DOC)
		const res = await scenario(home, ["fork", "base", "early", "--set", "economy.inflation=no"])
		expect(res.code).toBe(2)
		expect(errorOf(res).hint).toContain("Quote a string")
	})
})
