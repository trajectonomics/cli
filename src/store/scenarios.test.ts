import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { must, mustOpen, tempHome } from "./testing"

const DOC = { schemaVersion: 1, b: null, accounts: [{ rate: 0.025, name: "ออมทรัพย์" }] }
const CANONICAL = '{"accounts":[{"name":"ออมทรัพย์","rate":0.025}],"b":null,"schemaVersion":1}'
const HASH = "jcs1:sha256:76c6971cb0c71649e3028526cc4dd121091ff061844fd189cc271046f41d6686"

describe("scenarios", () => {
	it("stores a new scenario as JCS canonical text with an algorithm-tagged hash", () => {
		const store = mustOpen(tempHome())
		const saved = must(store.saveScenario({ name: "base", document: DOC }))
		expect(saved.status).toBe("created")
		expect(saved.scenario).toMatchObject({
			name: "base",
			document: CANONICAL,
			contentHash: HASH,
			forkedFrom: null,
			version: 1,
			deletedAt: null,
		})
		expect(must(store.listScenarios({ sort: "name" }))).toEqual([saved.scenario])
	})

	it("leaves an unchanged document alone and versions a changed one", () => {
		const store = mustOpen(tempHome())
		const first = must(store.saveScenario({ name: "base", document: DOC }))
		const reordered = { accounts: [{ name: "ออมทรัพย์", rate: 0.025 }], b: null, schemaVersion: 1 }
		const same = must(store.saveScenario({ name: "base", document: reordered }))
		expect(same).toEqual({ status: "unchanged", scenario: first.scenario })
		const changed = must(store.saveScenario({ name: "base", document: { schemaVersion: 2 } }))
		expect(changed.status).toBe("updated")
		expect(changed.scenario).toMatchObject({
			id: first.scenario.id,
			document: '{"schemaVersion":2}',
			version: 2,
			createdAt: first.scenario.createdAt,
			// The unchanged save read no clock, so this is the second reading.
			updatedAt: "2026-01-01T00:00:01.000Z",
		})
	})

	it("refuses a document that is not an object with an integer schemaVersion", () => {
		const store = mustOpen(tempHome())
		const cases: [unknown, string][] = [
			[[1], "document"],
			[{ name: "x" }, "document.schemaVersion"],
			[{ schemaVersion: "1" }, "document.schemaVersion"],
			[{ schemaVersion: 1, rate: Number.NaN }, "document.rate"],
		]
		for (const [document, path] of cases) {
			const outcome = store.saveScenario({ name: "x", document })
			if (!isAppError(outcome)) throw new Error(`accepted ${JSON.stringify(document)}`)
			expect(outcome.body).toMatchObject({ code: "invalid_input", exitCode: 2, path })
		}
		expect(must(store.listScenarios({ sort: "id" }))).toEqual([])
	})

	it("forks a scenario into a new row that remembers its origin", () => {
		const store = mustOpen(tempHome())
		const base = must(store.saveScenario({ name: "base", document: DOC })).scenario
		const fork = must(store.forkScenario(base.id, "early"))
		expect(fork.status).toBe("forked")
		if (fork.status === "not_found") return
		expect(fork.scenario).toMatchObject({
			name: "early",
			document: CANONICAL,
			contentHash: HASH,
			forkedFrom: base.id,
			version: 1,
		})
		expect(fork.scenario.id).not.toBe(base.id)
		expect(must(store.forkScenario(base.id, "early"))).toEqual({
			status: "name_taken",
			scenario: fork.scenario,
		})
		expect(must(store.forkScenario("nope", "late"))).toEqual({ status: "not_found" })
	})

	it("tombstones a scenario, frees its name and keeps the tombstone for export", () => {
		const store = mustOpen(tempHome())
		const base = must(store.saveScenario({ name: "base", document: DOC })).scenario
		const deleted = must(store.deleteScenario(base.id))
		expect(deleted).toEqual({
			status: "deleted",
			scenario: {
				...base,
				version: 2,
				updatedAt: "2026-01-01T00:00:01.000Z",
				deletedAt: "2026-01-01T00:00:01.000Z",
			},
		})
		expect(must(store.deleteScenario(base.id))).toEqual({ status: "not_found" })
		expect(must(store.saveScenario({ name: "base", document: DOC })).status).toBe("created")
		expect(must(store.listScenarios({ sort: "created_at", includeDeleted: true }))).toHaveLength(2)
		expect(must(store.listScenarios({ sort: "created_at" }))).toHaveLength(1)
	})
})
