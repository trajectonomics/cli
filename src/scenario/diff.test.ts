import { describe, expect, it } from "bun:test"
import { diffDocuments } from "./diff"

function changes(a: unknown, b: unknown) {
	return diffDocuments(a, b)
}

describe("diffDocuments", () => {
	it("returns no changes for deeply equal values regardless of key order", () => {
		expect(changes({ a: 1, b: { c: [1, 2] } }, { b: { c: [1, 2] }, a: 1 })).toEqual([])
	})

	it("reports a removed object as one whole change and suppresses its descendants", () => {
		expect(changes({ keep: 1, gone: { a: 1, b: { c: 2 } } }, { keep: 1 })).toEqual([
			{ path: "gone", kind: "removed", before: { a: 1, b: { c: 2 } } },
		])
	})

	it("reports a changed nested object's leaves only when both sides are objects", () => {
		expect(changes({ a: { b: 1, c: 2 } }, { a: { b: 1, c: 3 } })).toEqual([
			{ path: "a.c", kind: "changed", before: 2, after: 3 },
		])
	})

	it("treats an array with duplicate ids as one atomic value", () => {
		const before = [
			{ id: "a", v: 1 },
			{ id: "a", v: 2 },
		]
		const after = [
			{ id: "a", v: 2 },
			{ id: "a", v: 1 },
		]
		expect(changes({ list: before }, { list: after })).toEqual([
			{ path: "list", kind: "changed", before, after },
		])
	})

	it("compares list items by id even when their positions move", () => {
		const before = [
			{ id: "a", v: 1 },
			{ id: "b", v: 2 },
		]
		const after = [
			{ id: "a", v: 1 },
			{ id: "b", v: 3 },
		]
		expect(changes({ list: before }, { list: after })).toEqual([
			{ path: "list.b.v", kind: "changed", before: 2, after: 3 },
		])
	})

	it("sorts by unescaped segments in UTF-16 order", () => {
		const paths = changes({ x: { b: 1, a: 1 }, y: 1 }, { x: { b: 2, a: 2 }, y: 2 }).map(
			(change) => change.path,
		)
		expect(paths).toEqual(["x.a", "x.b", "y"])
	})

	it("does not mutate either side", () => {
		const before = { schemaVersion: 1, list: [{ id: "a", v: 1 }] }
		const after = { schemaVersion: 1, list: [{ id: "a", v: 2 }] }
		const snapshot = JSON.stringify([before, after])
		changes(before, after)
		expect(JSON.stringify([before, after])).toBe(snapshot)
	})

	it("treats an empty list on one side as one atomic change", () => {
		expect(changes({ list: [{ id: "a" }] }, { list: [] })).toEqual([
			{ path: "list", kind: "changed", before: [{ id: "a" }], after: [] },
		])
	})
})
