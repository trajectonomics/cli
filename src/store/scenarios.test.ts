import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { SCENARIO_DOCUMENT } from "../scenario-test-support"
import { must, mustOpen, tempHome } from "./testing"

const DOC = SCENARIO_DOCUMENT
const CANONICAL =
	'{"accounts":[{"id":"cash","kind":"asset","rate":0},{"id":"loan","kind":"liability","rate":0}],"cashflow":{"surplus":[{"account":"cash"}],"withdraw":["cash"]},"currency":"THB","economy":{"inflation":0},"flows":[{"amount":100000,"earned":true,"frequency":"monthly","growth":"inflation","id":"salary","kind":"income","start":"2026-01-01"},{"amount":5000,"earned":true,"frequency":"annual","growth":"inflation","id":"bonus","kind":"income","start":"2026-01-01"}],"schemaVersion":1}'
const HASH = "jcs1:sha256:d1a135c445a13c504106685155f5a2b630ed5414138d5351475d1d7ff1cd499c"
const CHANGED =
	'{"accounts":[{"id":"cash","kind":"asset","rate":0},{"id":"loan","kind":"liability","rate":0}],"cashflow":{"surplus":[{"account":"cash"}],"withdraw":["cash"]},"currency":"THB","economy":{"inflation":100},"flows":[{"amount":100000,"earned":true,"frequency":"monthly","growth":"inflation","id":"salary","kind":"income","start":"2026-01-01"},{"amount":5000,"earned":true,"frequency":"annual","growth":"inflation","id":"bonus","kind":"income","start":"2026-01-01"}],"schemaVersion":1}'

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
		const reordered = {
			schemaVersion: DOC.schemaVersion,
			flows: DOC.flows,
			currency: DOC.currency,
			economy: DOC.economy,
			cashflow: DOC.cashflow,
			accounts: [
				{ rate: 0, kind: "asset", id: "cash" },
				{ id: "loan", rate: 0, kind: "liability" },
			],
		}
		const same = must(store.saveScenario({ name: "base", document: reordered }))
		expect(same).toEqual({ status: "unchanged", scenario: first.scenario })
		const changed = must(
			store.saveScenario({ name: "base", document: { ...DOC, economy: { inflation: 100 } } }),
		)
		expect(changed.status).toBe("updated")
		expect(changed.scenario).toMatchObject({
			id: first.scenario.id,
			document: CHANGED,
			version: 2,
			createdAt: first.scenario.createdAt,
			// The unchanged save read no clock, so this is the second reading.
			updatedAt: "2026-01-01T00:00:01.000Z",
		})
	})

	it("refuses a document sim-core does not accept, at the failing document path", () => {
		const store = mustOpen(tempHome())
		const cases: [unknown, string][] = [
			[[1], "document"],
			[{ name: "x" }, "document.schemaVersion"],
			[{ schemaVersion: "1" }, "document.schemaVersion"],
			[{ ...DOC, economy: { inflation: Number.NaN } }, "document.economy.inflation"],
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
