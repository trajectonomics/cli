import { describe, expect, it } from "bun:test"
import { edited } from "./baseline/testing"
import {
	applyScenario,
	errorOf,
	resultOf,
	rowOf,
	scenario,
	scenarioHome,
	summariesOf,
} from "./scenario-test-support"
import { PERSONAL_ENTITY_ID } from "./store"
import { mustOpen, SCENARIO_DOCUMENT } from "./store/testing"

const BASE = SCENARIO_DOCUMENT

/** A v1 row written before the pin bump to Scenario v4 (ADR-0031): stored, never migrated. */
const V1_DOCUMENT =
	'{"accounts":[{"id":"cash","kind":"asset","rate":0},{"id":"loan","kind":"liability","rate":0}],"cashflow":{"surplus":[{"account":"cash"}],"withdraw":["cash"]},"currency":"THB","economy":{"inflation":0},"flows":[{"amount":100000,"earned":true,"frequency":"monthly","growth":"inflation","id":"salary","kind":"income","start":"2026-01-01"},{"amount":5000,"earned":true,"frequency":"annual","growth":"inflation","id":"bonus","kind":"income","start":"2026-01-01"}],"schemaVersion":1}'
const V1_HASH = "jcs1:sha256:d1a135c445a13c504106685155f5a2b630ed5414138d5351475d1d7ff1cd499c"

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

	it("still prints a stored v1 Scenario, because the bump to v4 never migrated a row", async () => {
		const home = scenarioHome()
		mustOpen(home).close()
		edited(
			home,
			`INSERT INTO scenario (id, entity_id, name, document, content_hash, forked_from, version, created_at, updated_at)
			VALUES ('0194e000-0001-7000-8000-000000000001', '${PERSONAL_ENTITY_ID}', 'old', '${V1_DOCUMENT}',
			'${V1_HASH}', NULL, 1, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
		)
		const res = await scenario(home, ["show", "old"])
		expect(res.code).toBe(0)
		expect(rowOf(resultOf(res))).toMatchObject({
			name: "old",
			document: JSON.parse(V1_DOCUMENT),
			contentHash: V1_HASH,
		})
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
