import { describe, expect, it } from "bun:test"
import {
	applyScenario,
	errorOf,
	resultOf,
	rowOf,
	scenario,
	scenarioHome,
} from "./scenario-test-support"
import { capture } from "./test-support"

const A = {
	schemaVersion: 1,
	goal: { amount: 1_000, note: "old" },
	streams: [
		{ id: "salary", amount: 1 },
		{ id: "bonus", amount: 2 },
	],
}

const B = {
	schemaVersion: 1,
	goal: { amount: 2_000, extra: true },
	streams: [
		{ id: "salary", amount: 5 },
		{ id: "bonus", amount: 2 },
	],
}

type ChangeBody = { path: string; kind: string; before?: unknown; after?: unknown }

function changesOf(data: unknown): ChangeBody[] {
	return (data as { changes: ChangeBody[] }).changes
}

describe("scenario diff", () => {
	it("reports two equal documents, including a Scenario against itself, as identical", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", A)
		await applyScenario(home, "copy", A)
		for (const pair of [
			["base", "base"],
			["base", "copy"],
		]) {
			const res = await scenario(home, ["diff", ...pair])
			expect(res.code).toBe(0)
			const data = resultOf(res)
			expect(data.identical).toBe(true)
			expect(data.changes).toEqual([])
		}
	})

	it("names both refs and every added, removed and changed path", async () => {
		const home = scenarioHome()
		const a = rowOf(resultOf(await applyScenario(home, "a", A)))
		const b = rowOf(resultOf(await applyScenario(home, "b", B)))
		const data = resultOf(await scenario(home, ["diff", "a", "b"]))
		expect(data.identical).toBe(false)
		expect(data.a).toEqual({ id: a.id, name: "a", contentHash: a.contentHash })
		expect(data.b).toEqual({ id: b.id, name: "b", contentHash: b.contentHash })
		expect(changesOf(data)).toEqual([
			{ path: "goal.amount", kind: "changed", before: 1_000, after: 2_000 },
			{ path: "goal.extra", kind: "added", after: true },
			{ path: "goal.note", kind: "removed", before: "old" },
			{ path: "streams.salary.amount", kind: "changed", before: 1, after: 5 },
		])
	})

	it("matches id-keyed items by id and reports an added or removed item whole", async () => {
		const home = scenarioHome()
		await applyScenario(home, "a", {
			schemaVersion: 1,
			items: [
				{ id: "one", v: 1 },
				{ id: "two", v: 2 },
			],
		})
		await applyScenario(home, "b", {
			schemaVersion: 1,
			items: [
				{ id: "one", v: 9 },
				{ id: "three", v: 3 },
			],
		})
		const changes = changesOf(resultOf(await scenario(home, ["diff", "a", "b"])))
		expect(changes).toEqual([
			{ path: "items.one.v", kind: "changed", before: 1, after: 9 },
			{ path: "items.three", kind: "added", after: { id: "three", v: 3 } },
			{ path: "items.two", kind: "removed", before: { id: "two", v: 2 } },
		])
	})

	it("reports a reordered id list as one atomic change, even with items added or removed", async () => {
		const home = scenarioHome()
		const before = { schemaVersion: 1, items: [{ id: "a" }, { id: "b" }, { id: "c" }] }
		const after = { schemaVersion: 1, items: [{ id: "c" }, { id: "d" }, { id: "a" }] }
		await applyScenario(home, "a", before)
		await applyScenario(home, "b", after)
		const changes = changesOf(resultOf(await scenario(home, ["diff", "a", "b"])))
		expect(changes).toEqual([
			{ path: "items", kind: "changed", before: before.items, after: after.items },
		])
	})

	it("treats a list without ids, or id-keyed on one side only, as one value", async () => {
		const home = scenarioHome()
		await applyScenario(home, "a", { schemaVersion: 1, list: [1, 2], mixed: [{ id: "x" }] })
		await applyScenario(home, "b", { schemaVersion: 1, list: [2, 1], mixed: [] })
		const changes = changesOf(resultOf(await scenario(home, ["diff", "a", "b"])))
		expect(changes).toEqual([
			{ path: "list", kind: "changed", before: [1, 2], after: [2, 1] },
			{ path: "mixed", kind: "changed", before: [{ id: "x" }], after: [] },
		])
	})

	it("sorts changes by unescaped segment and repeats byte for byte", async () => {
		const home = scenarioHome()
		await applyScenario(home, "a", { schemaVersion: 1, B: 1, a: 1, "a.b": 1 })
		await applyScenario(home, "b", { schemaVersion: 1, B: 2, a: 2, "a.b": 2 })
		const first = await scenario(home, ["diff", "a", "b"])
		const second = await scenario(home, ["diff", "a", "b"])
		expect(second.out).toBe(first.out)
		expect(changesOf(resultOf(first)).map((change) => change.path)).toEqual(["B", "a", "a\\.b"])
	})

	it("reports a missing side as not_found at a or b", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", A)
		const first = await scenario(home, ["diff", "nope", "base"])
		expect(first.code).toBe(4)
		expect(errorOf(first)).toMatchObject({
			code: "not_found",
			path: "a",
			details: { resource: "scenario" },
		})
		const second = await scenario(home, ["diff", "base", "nope"])
		expect(second.code).toBe(4)
		expect(errorOf(second)).toMatchObject({ code: "not_found", path: "b" })
	})

	it("is listed by the schema", async () => {
		const described = resultOf(await capture(["schema", "scenario", "diff", "--json"]))
		expect(described.name).toBe("scenario diff")
		expect(described.positionals).toEqual(["a", "b"])
	})
})
