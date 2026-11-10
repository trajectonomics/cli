import { describe, expect, it } from "bun:test"
import {
	applyScenario,
	documentFile,
	errorOf,
	resultOf,
	rowOf,
	scenario,
	scenarioHome,
} from "./scenario-test-support"
import { capture } from "./test-support"

const DOC = {
	schemaVersion: 1,
	goal: { amount: 1_000_000 },
	streams: [{ id: "salary", amount: 40_000 }],
}

describe("scenario apply", () => {
	it("creates a Scenario from a file and reports the written row", async () => {
		const res = await capture(
			["scenario", "apply", "base", "--file", documentFile(DOC), "--json"],
			{ TRAJ_HOME: scenarioHome() },
		)
		expect(res.code).toBe(0)
		const data = resultOf(res)
		expect(data.status).toBe("created")
		expect(data.dryRun).toBe(false)
		const scenario = rowOf(data)
		expect(scenario.id).toMatch(/^[0-9a-f-]{36}$/)
		expect(scenario.name).toBe("base")
		expect(scenario.version).toBe(1)
		expect(scenario.forkedFrom).toBeNull()
		expect(scenario.contentHash).toMatch(/^jcs1:sha256:/)
		expect(scenario.document).toEqual({
			schemaVersion: 1,
			goal: { amount: 1_000_000 },
			streams: [{ id: "salary", amount: 40_000 }],
		})
	})

	it("reads the same document from stdin with --file -", async () => {
		const home = scenarioHome()
		const res = await applyScenario(home, "base", DOC)
		expect(res.code).toBe(0)
		expect(resultOf(res).status).toBe("created")
	})

	it("reports an identical document as unchanged and leaves the row alone", async () => {
		const home = scenarioHome()
		const first = await applyScenario(home, "base", DOC)
		const before = rowOf(resultOf(first))
		const reordered =
			'{\n  "streams": [{"amount": 40000, "id": "salary"}],\n  "goal": {"amount": 1000000},\n  "schemaVersion": 1\n}\n'
		const second = await applyScenario(home, "base", reordered)
		expect(second.code).toBe(0)
		expect(resultOf(second).status).toBe("unchanged")
		expect(resultOf(second).scenario).toEqual(before)
	})

	it("updates a changed document, keeping the id and bumping the version once", async () => {
		const home = scenarioHome()
		const first = rowOf(resultOf(await applyScenario(home, "base", DOC)))
		const changed = { ...DOC, goal: { amount: 2_000_000 } }
		const second = resultOf(await applyScenario(home, "base", changed))
		expect(second.status).toBe("updated")
		const scenario = rowOf(second)
		expect(scenario.id).toBe(first.id)
		expect(scenario.forkedFrom).toBeNull()
		expect(scenario.version).toBe(2)
		expect(scenario.createdAt).toBe(first.createdAt)
		expect(scenario.document).toMatchObject({ goal: { amount: 2_000_000 } })
	})

	it("refuses a document that is not the envelope, at the documented path", async () => {
		const home = scenarioHome()
		const cases: [string, string][] = [
			["", "file"],
			["{not json", "file"],
			["[]", "document"],
			['{"goal":{}}', "document.schemaVersion"],
			['{"schemaVersion":"1"}', "document.schemaVersion"],
			['{"schemaVersion":0}', "document.schemaVersion"],
			['{"schemaVersion":1.5}', "document.schemaVersion"],
		]
		for (const [document, path] of cases) {
			const res = await applyScenario(home, "base", document)
			expect(res.code).toBe(2)
			expect(errorOf(res)).toMatchObject({ code: "invalid_input", path })
		}
		expect(resultOf(await scenario(home, ["list"])).scenarios).toEqual([])
	})

	it("requires --file before any document is read", async () => {
		const res = await scenario(scenarioHome(), ["apply", "base"])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "file" })
	})

	it("refuses a name shaped like a UUID", async () => {
		const res = await applyScenario(scenarioHome(), "0194a000-0002-7000-8000-000000000002", DOC)
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "name" })
	})

	it("keeps a dry-run create's id null and writes nothing", async () => {
		const home = scenarioHome()
		const res = await applyScenario(home, "base", DOC, ["--dry-run"])
		expect(res.code).toBe(0)
		const data = resultOf(res)
		expect(data.dryRun).toBe(true)
		expect(rowOf(data).id).toBeNull()
		expect(resultOf(await scenario(home, ["list"])).scenarios).toEqual([])
	})

	it("keeps an existing id on a dry-run update and rolls the document back", async () => {
		const home = scenarioHome()
		const first = rowOf(resultOf(await applyScenario(home, "base", DOC)))
		const changed = { ...DOC, goal: { amount: 9_000_000 } }
		const dry = resultOf(await applyScenario(home, "base", changed, ["--dry-run"]))
		expect(dry.status).toBe("updated")
		expect(rowOf(dry).id).toBe(first.id)
		const shown = rowOf(resultOf(await scenario(home, ["show", "base"])))
		expect(shown.version).toBe(1)
		expect(shown.document).toMatchObject({ goal: { amount: 1_000_000 } })
	})

	it("is listed by the schema with its document shape", async () => {
		const home = scenarioHome()
		const listing = resultOf(await scenario(home, ["list"]))
		expect(listing).toEqual({ scenarios: [] })
		const described = resultOf(await capture(["schema", "scenario", "apply", "--json"]))
		expect(described.name).toBe("scenario apply")
		const document = described.document as { flag: string; schema: { required: string[] } }
		expect(document.flag).toBe("file")
		expect(document.schema.required).toEqual(["schemaVersion"])
		expect(described.errorCodes).toContain("invalid_input")
		expect(described.errorCodes).toContain("database_busy")
	})
})
