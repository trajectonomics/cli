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

const BASE = SCENARIO_DOCUMENT

describe("scenario list and show", () => {
	it("returns an empty list at exit 0 for an empty database", async () => {
		const res = await scenario(scenarioHome(), ["list"])
		expect(res.code).toBe(0)
		expect(resultOf(res)).toEqual({ scenarios: [] })
	})

	it("lists live Scenarios by name without their documents", async () => {
		const home = scenarioHome()
		for (const name of ["zeta", "alpha", "Alpha"]) await applyScenario(home, name, BASE)
		const summaries = summariesOf(resultOf(await scenario(home, ["list"])))
		expect(summaries.map((summary) => summary.name)).toEqual(["Alpha", "alpha", "zeta"])
		for (const summary of summaries) {
			expect(Object.keys(summary).sort()).toEqual([
				"contentHash",
				"createdAt",
				"forkedFrom",
				"id",
				"name",
				"updatedAt",
				"version",
			])
		}
	})

	it("shows one Scenario by name or id with the document parsed as JSON", async () => {
		const home = scenarioHome()
		const created = rowOf(resultOf(await applyScenario(home, "base", BASE)))
		const byName = rowOf(resultOf(await scenario(home, ["show", "base"])))
		const byId = rowOf(resultOf(await scenario(home, ["show", created.id as string])))
		expect(byName).toEqual(created)
		expect(byId).toEqual(created)
		const view = byName
		expect(view.document).toEqual(SCENARIO_DOCUMENT)
		expect(view).not.toHaveProperty("deletedAt")
		expect(view.forkedFrom).toBeNull()
	})

	it("reports a missing Scenario as not_found at exit 4", async () => {
		const home = scenarioHome()
		const res = await scenario(home, ["show", "nope"])
		expect(res.code).toBe(4)
		expect(errorOf(res)).toMatchObject({
			code: "not_found",
			details: { resource: "scenario" },
		})
		expect(errorOf(res).hint).toContain("scenario list")
	})

	it("reports a tombstoned Scenario as not_found, not an empty view", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", BASE)
		expect((await scenario(home, ["rm", "base"])).code).toBe(0)
		const res = await scenario(home, ["show", "base"])
		expect(res.code).toBe(4)
		expect(errorOf(res).code).toBe("not_found")
		expect(resultOf(await scenario(home, ["list"])).scenarios).toEqual([])
	})

	it("pipes the shown document straight back into apply", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", BASE)
		const shown = rowOf(resultOf(await scenario(home, ["show", "base"])))
		const document = JSON.stringify(shown.document)
		const applied = await applyScenario(home, "copy", document)
		expect(resultOf(applied).status).toBe("created")
		const diff = resultOf(await scenario(home, ["diff", "base", "copy"]))
		expect(diff.identical).toBe(true)
		expect(diff.changes).toEqual([])
	})
})
