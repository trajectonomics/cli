import { describe, expect, it } from "bun:test"
import { fail, isAppError } from "../errors"
import { must, mustOpen, SCENARIO_DOCUMENT, tempHome } from "./testing"

const DOC = SCENARIO_DOCUMENT

describe("scenario reads and dry runs", () => {
	it("resolves an id first and then a live name, never a tombstone", () => {
		const store = mustOpen(tempHome())
		const base = must(store.saveScenario({ name: "base", document: DOC })).scenario
		must(store.saveScenario({ name: base.id, document: DOC }))
		expect(must(store.getScenario(base.id))).toEqual(base)
		expect(must(store.getScenario("base"))).toEqual(base)
		expect(must(store.getScenario("nope"))).toBeNull()
		must(store.deleteScenario(base.id))
		expect(must(store.getScenario("base"))).toBeNull()
	})

	it("rolls a dry-run create back after reporting the row", () => {
		const store = mustOpen(tempHome())
		const saved = must(store.saveScenario({ name: "base", document: DOC }, { dryRun: true }))
		expect(saved.status).toBe("created")
		expect(saved.scenario.id).not.toBe("")
		expect(must(store.listScenarios({ sort: "name" }))).toEqual([])
	})

	it("rolls a dry-run update back", () => {
		const store = mustOpen(tempHome())
		const base = must(store.saveScenario({ name: "base", document: DOC })).scenario
		const dry = must(
			store.saveScenario(
				{ name: "base", document: { ...DOC, economy: { inflation: 100 } } },
				{ dryRun: true },
			),
		)
		expect(dry.status).toBe("updated")
		expect(dry.scenario.version).toBe(2)
		expect(must(store.getScenario("base"))).toEqual(base)
	})

	it("leaves the row live after a dry-run delete", () => {
		const store = mustOpen(tempHome())
		const base = must(store.saveScenario({ name: "base", document: DOC })).scenario
		const dry = must(store.deleteScenario(base.id, { dryRun: true }))
		expect(dry).toMatchObject({ status: "deleted", scenario: { id: base.id, version: 2 } })
		expect(must(store.getScenario("base"))).toEqual(base)
	})
})

describe("forkScenario transform", () => {
	it("applies the transform inside the write and never touches the source", () => {
		const store = mustOpen(tempHome())
		const base = must(store.saveScenario({ name: "base", document: DOC })).scenario
		const fork = must(
			store.forkScenario(base.id, "early", {
				transform: (document) => ({ ...document, currency: "USD" }),
			}),
		)
		expect(fork.status).toBe("forked")
		if (fork.status === "not_found") return
		expect(fork.scenario).toMatchObject({ forkedFrom: base.id, version: 1 })
		expect(JSON.parse(fork.scenario.document)).toMatchObject({ currency: "USD" })
		expect(must(store.getScenario(base.id))).toEqual(base)
	})

	it("rolls the whole fork back when the transform returns an error", () => {
		const store = mustOpen(tempHome())
		const base = must(store.saveScenario({ name: "base", document: DOC })).scenario
		const outcome = store.forkScenario(base.id, "early", {
			transform: () => fail("invalid_input", { path: "set" }),
		})
		if (!isAppError(outcome)) throw new Error("the fork was written")
		expect(outcome.body).toMatchObject({ code: "invalid_input", path: "set" })
		expect(must(store.listScenarios({ sort: "name" }))).toHaveLength(1)
	})

	it("writes no row on a dry-run fork but still reports the copy", () => {
		const store = mustOpen(tempHome())
		const base = must(store.saveScenario({ name: "base", document: DOC })).scenario
		const fork = must(store.forkScenario(base.id, "early", { dryRun: true }))
		expect(fork.status).toBe("forked")
		expect(must(store.listScenarios({ sort: "name" }))).toHaveLength(1)
	})
})
