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
import { capture } from "./test-support"

const BASE = { schemaVersion: 1, goal: { amount: 1_000_000 } }

describe("scenario fork", () => {
	it("copies a Scenario under a new name and keeps the source byte-identical", async () => {
		const home = scenarioHome()
		const base = rowOf(resultOf(await applyScenario(home, "base", BASE)))
		const res = await scenario(home, ["fork", "base", "early"])
		expect(res.code).toBe(0)
		const data = resultOf(res)
		expect(data.status).toBe("forked")
		expect(data.overrides).toEqual([])
		const fork = rowOf(data)
		expect(fork.name).toBe("early")
		expect(fork.forkedFrom).toBe(base.id)
		expect(fork.version).toBe(1)
		expect(fork.contentHash).toBe(base.contentHash)
		expect(fork.id).not.toBe(base.id)
		expect(resultOf(await scenario(home, ["show", "base"])).scenario).toEqual(base)
		expect(rowOf(resultOf(await scenario(home, ["show", "early"]))).id).toBe(fork.id)
	})

	it("resolves the source by id as well as by name", async () => {
		const home = scenarioHome()
		const base = rowOf(resultOf(await applyScenario(home, "base", BASE)))
		const res = await scenario(home, ["fork", base.id as string, "by-id"])
		expect(res.code).toBe(0)
		expect(rowOf(resultOf(res)).forkedFrom).toBe(base.id)
	})

	it("reports a live target name as scenario_name_taken at exit 5", async () => {
		const home = scenarioHome()
		const base = rowOf(resultOf(await applyScenario(home, "base", BASE)))
		const res = await scenario(home, ["fork", "base", "base"])
		expect(res.code).toBe(5)
		expect(errorOf(res)).toMatchObject({
			code: "scenario_name_taken",
			path: "name",
			details: { scenarioId: base.id },
		})
	})

	it("reports a missing source as not_found at the from field", async () => {
		const res = await scenario(scenarioHome(), ["fork", "nope", "early"])
		expect(res.code).toBe(4)
		expect(errorOf(res)).toMatchObject({
			code: "not_found",
			path: "from",
			details: { resource: "scenario" },
		})
	})

	it("refuses a target name shaped like a UUID", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", BASE)
		const res = await scenario(home, ["fork", "base", "0194a000-0002-7000-8000-000000000002"])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "name" })
	})

	it("writes nothing on a dry run and reports a null fork id", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", BASE)
		const dry = resultOf(await scenario(home, ["fork", "base", "early", "--dry-run"]))
		expect(dry.dryRun).toBe(true)
		expect(rowOf(dry).id).toBeNull()
		const names = summariesOf(resultOf(await scenario(home, ["list"]))).map(
			(summary) => summary.name,
		)
		expect(names).toEqual(["base"])
	})

	it("is listed by the schema with its repeatable set flag", async () => {
		const described = resultOf(await capture(["schema", "scenario", "fork", "--json"]))
		expect(described.name).toBe("scenario fork")
		const input = described.input as { properties: { set: { type: string; items: unknown } } }
		expect(input.properties.set.type).toBe("array")
		expect(input.properties.set.items).toMatchObject({ type: "string" })
	})
})
