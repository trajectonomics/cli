import { describe, expect, it } from "bun:test"
import {
	applyScenario,
	errorOf,
	resultOf,
	rowOf,
	scenario,
	scenarioHome,
} from "./scenario-test-support"
import { SCENARIO_DOCUMENT } from "./store/testing"
import { capture } from "./test-support"

const BASE = SCENARIO_DOCUMENT

describe("scenario rm", () => {
	it("tombstones a Scenario and reports the deletion once", async () => {
		const home = scenarioHome()
		const created = rowOf(resultOf(await applyScenario(home, "early", BASE)))
		const res = await scenario(home, ["rm", "early"])
		expect(res.code).toBe(0)
		const data = resultOf(res)
		expect(data.status).toBe("deleted")
		expect(data.dryRun).toBe(false)
		expect(data.deletedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
		const scenarioView = rowOf(data)
		expect(scenarioView.id).toBe(created.id)
		expect(scenarioView.version).toBe(2)
		expect(scenarioView).not.toHaveProperty("deletedAt")
	})

	it("frees the name for a new Scenario with a new id", async () => {
		const home = scenarioHome()
		const first = rowOf(resultOf(await applyScenario(home, "base", BASE)))
		await scenario(home, ["rm", "base"])
		const second = rowOf(resultOf(await applyScenario(home, "base", BASE)))
		expect(second.id).not.toBe(first.id)
		expect(second.version).toBe(1)
		expect(second.forkedFrom).toBeNull()
	})

	it("reports a missing or already-tombstoned Scenario as not_found", async () => {
		const home = scenarioHome()
		expect((await scenario(home, ["rm", "nope"])).code).toBe(4)
		await applyScenario(home, "base", BASE)
		await scenario(home, ["rm", "base"])
		const again = await scenario(home, ["rm", "base"])
		expect(again.code).toBe(4)
		expect(errorOf(again)).toMatchObject({
			code: "not_found",
			details: { resource: "scenario" },
		})
	})

	it("removes a Scenario that has live forks, and the forks stay readable", async () => {
		const home = scenarioHome()
		const base = rowOf(resultOf(await applyScenario(home, "base", BASE)))
		const fork = rowOf(resultOf(await scenario(home, ["fork", "base", "early"])))
		expect((await scenario(home, ["rm", "base"])).code).toBe(0)
		const shown = rowOf(resultOf(await scenario(home, ["show", "early"])))
		expect(shown.id).toBe(fork.id)
		expect(shown.forkedFrom).toBe(base.id)
	})

	it("leaves the row live on a dry run and still reports the row", async () => {
		const home = scenarioHome()
		const created = rowOf(resultOf(await applyScenario(home, "base", BASE)))
		const dry = resultOf(await scenario(home, ["rm", "base", "--dry-run"]))
		expect(dry.status).toBe("deleted")
		expect(dry.dryRun).toBe(true)
		expect(rowOf(dry).id).toBe(created.id)
		const shown = rowOf(resultOf(await scenario(home, ["show", "base"])))
		expect(shown.version).toBe(1)
	})

	it("is listed by the schema with its dry-run flag", async () => {
		const described = resultOf(await capture(["schema", "scenario", "rm", "--json"]))
		expect(described.name).toBe("scenario rm")
		const input = described.input as { properties: Record<string, unknown> }
		expect(Object.keys(input.properties)).toEqual(["scenario", "dryRun"])
	})
})
