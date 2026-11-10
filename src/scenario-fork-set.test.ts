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

describe("scenario fork --set", () => {
	it("changes only the fork's copy and echoes the applied override", async () => {
		const home = scenarioHome()
		const base = rowOf(resultOf(await applyScenario(home, "base", STREAMS)))
		const res = await scenario(home, [
			"fork",
			"base",
			"early",
			"--set",
			"streams.salary.amount=50000",
		])
		expect(res.code).toBe(0)
		const data = resultOf(res)
		expect(overridesOf(data)).toEqual([{ path: "streams.salary.amount", value: 50_000 }])
		const fork = rowOf(data)
		expect((fork.document as { streams: unknown[] }).streams).toContainEqual({
			id: "salary",
			amount: 50_000,
		})
		expect(rowOf(resultOf(await scenario(home, ["show", "base"]))).document).toEqual(base.document)
	})

	it("applies several sets in command-line order and echoes them in that order", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", STREAMS)
		const res = await scenario(home, [
			"fork",
			"base",
			"early",
			"--set",
			"goal.amount=2000000",
			"--set",
			"streams.bonus.amount=7000",
		])
		const data = resultOf(res)
		expect(overridesOf(data).map((override) => override.path)).toEqual([
			"goal.amount",
			"streams.bonus.amount",
		])
		expect(rowOf(data).document).toMatchObject({
			goal: { amount: 2_000_000 },
		})
	})

	it("refuses an exact duplicate path", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", STREAMS)
		const res = await scenario(home, [
			"fork",
			"base",
			"early",
			"--set",
			"goal.amount=1",
			"--set",
			"goal.amount=2",
		])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({
			code: "invalid_input",
			path: "set",
			details: { path: "goal.amount" },
		})
	})

	it("fails a typo with a did-you-mean hint and writes no fork", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", STREAMS)
		const res = await scenario(home, ["fork", "base", "early", "--set", "streams.salery.amount=1"])
		expect(res.code).toBe(2)
		const error = errorOf(res)
		expect(error).toMatchObject({
			code: "invalid_input",
			path: "set",
			details: {
				index: 0,
				path: "streams.salery.amount",
				segment: "salery",
				suggestion: "streams.salary.amount",
			},
		})
		expect(error.hint).toContain("streams.salary.amount")
		const names = summariesOf(resultOf(await scenario(home, ["list"]))).map(
			(summary) => summary.name,
		)
		expect(names).toEqual(["base"])
	})

	it("lists known siblings when no candidate is close", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", STREAMS)
		const res = await scenario(home, ["fork", "base", "early", "--set", "nothing.at.all=1"])
		expect(res.code).toBe(2)
		expect(errorOf(res).details).toMatchObject({ suggestion: null })
		expect(errorOf(res).hint).toContain("schemaVersion")
	})

	it("keeps JSON value types", async () => {
		const home = scenarioHome()
		const doc = { schemaVersion: 1, n: 1, s: "a", b: false, z: 1, o: { k: 1 }, list: [1, 2] }
		await applyScenario(home, "base", doc)
		const res = await scenario(home, [
			"fork",
			"base",
			"typed",
			"--set",
			"n=50000",
			"--set",
			's="50000"',
			"--set",
			"b=true",
			"--set",
			"z=null",
			"--set",
			'o={"k":2}',
			"--set",
			"list=[1,2,3]",
		])
		expect(res.code).toBe(0)
		const fork = rowOf(resultOf(res))
		expect(fork.document).toEqual({
			schemaVersion: 1,
			b: true,
			list: [1, 2, 3],
			n: 50_000,
			o: { k: 2 },
			s: "50000",
			z: null,
		})
	})

	it("refuses a bare word with a quoting hint", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", STREAMS)
		const res = await scenario(home, ["fork", "base", "early", "--set", "goal.amount=not-json"])
		expect(res.code).toBe(2)
		expect(errorOf(res).hint).toContain("Quote a string")
	})
})
