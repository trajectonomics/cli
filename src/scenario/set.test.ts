import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { applyOverrides } from "./set-apply"

type Doc = Record<string, unknown>

function applied(document: Doc, ...sets: string[]) {
	const outcome = applyOverrides(document, sets)
	if (isAppError(outcome)) throw new Error(JSON.stringify(outcome.body))
	return outcome
}

function failed(document: Doc, ...sets: string[]) {
	const outcome = applyOverrides(document, sets)
	if (!isAppError(outcome)) throw new Error(`accepted ${sets.join(" ")}`)
	return outcome.body
}

describe("applyOverrides", () => {
	it("returns the document and no overrides when there is nothing to set", () => {
		const document = { schemaVersion: 1 }
		const outcome = applied(document)
		expect(outcome.document).toBe(document)
		expect(outcome.overrides).toEqual([])
	})

	it("copies only the nodes on the path, leaving the input untouched", () => {
		const document = { schemaVersion: 1, goal: { amount: 1, note: "x" } }
		const outcome = applied(document, "goal.amount=2")
		expect(outcome.document).toEqual({ schemaVersion: 1, goal: { amount: 2, note: "x" } })
		expect(outcome.document).not.toBe(document)
		expect(document.goal.amount).toBe(1)
		expect(outcome.overrides).toEqual([{ path: "goal.amount", value: 2 }])
	})

	it("unescapes . \\ and = in a key and echoes the canonical path", () => {
		const document: Doc = { schemaVersion: 1, "a.b": 1, "c\\d": 1, "e=f": 1 }
		const outcome = applied(document, "a\\.b=2", "c\\\\d=3", "e\\=f=4")
		expect(outcome.document).toEqual({ schemaVersion: 1, "a.b": 2, "c\\d": 3, "e=f": 4 })
		expect(outcome.overrides.map((override) => override.path)).toEqual(["a\\.b", "c\\\\d", "e\\=f"])
	})

	it("refuses malformed paths and values at the set field", () => {
		const document = { schemaVersion: 1, a: { b: 1 } }
		for (const raw of ["a1", "=1", "a..b=1", "a.=1", "a\\", "a\\q=1", "a.b=not-json"]) {
			const body = failed(document, raw)
			expect(body).toMatchObject({ code: "invalid_input", path: "set" })
		}
	})

	it("refuses the same path twice", () => {
		const document = { schemaVersion: 1, a: 1 }
		expect(failed(document, "a=2", "a=3")).toMatchObject({
			path: "set",
			details: { index: 1, path: "a" },
		})
	})

	it("lets an earlier set be seen by a later one, but not by a duplicate", () => {
		const document = { schemaVersion: 1, goal: { amount: 1 } }
		const outcome = applied(document, 'goal={"amount":1}', "goal.amount=2")
		expect((outcome.document as Doc)["goal"]).toEqual({ amount: 2 })
		expect(outcome.overrides).toHaveLength(2)
	})

	it("never resolves prototype names, and keeps an own __proto__ a plain key", () => {
		for (const raw of ["toString=1", "constructor=1", "__proto__=1"]) {
			expect(failed({ schemaVersion: 1 }, raw).code).toBe("invalid_input")
		}
		const document = JSON.parse('{"schemaVersion":1,"__proto__":{"x":1}}') as Doc
		const outcome = applied(document, "__proto__.x=2")
		expect(Object.getPrototypeOf(outcome.document)).toBe(Object.prototype)
		expect(Object.hasOwn(outcome.document, "__proto__")).toBe(true)
		expect(Object.getOwnPropertyDescriptor(outcome.document, "__proto__")?.value).toEqual({ x: 2 })
		expect(Object.hasOwn(Object.prototype, "x")).toBe(false)
	})

	it("matches list items by id and reports an unknown or ambiguous id", () => {
		const document = {
			schemaVersion: 1,
			list: [
				{ id: "a", v: 1 },
				{ id: "b", v: 2 },
			],
		}
		expect((applied(document, "list.a.v=9").document as Doc)["list"]).toEqual([
			{ id: "a", v: 9 },
			{ id: "b", v: 2 },
		])
		expect(failed(document, "list.0.v=1")).toMatchObject({ details: { segment: "0" } })
		const duplicated = {
			schemaVersion: 1,
			list: [
				{ id: "a", v: 1 },
				{ id: "a", v: 2 },
			],
		}
		expect(failed(duplicated, "list.a.v=3")).toMatchObject({
			path: "set",
			details: { segment: "a" },
		})
	})

	it("will not change a list item's id or walk into a scalar", () => {
		const document = { schemaVersion: 1, list: [{ id: "a", v: 1 }], n: 1 }
		expect(failed(document, 'list.a={"id":"b"}')).toMatchObject({ details: { segment: "a" } })
		expect(failed(document, "list.a=5")).toMatchObject({ details: { segment: "a" } })
		expect(failed(document, "n.x=1")).toMatchObject({ details: { segment: "n" } })
	})

	it("refuses a new key because a schema cannot tell it from a typo", () => {
		expect(failed({ schemaVersion: 1, a: 1 }, "b=2")).toMatchObject({ path: "set" })
	})

	it("parses every value as JSON, so types stay types", () => {
		const document = { schemaVersion: 1, n: 1, s: "a", b: false, z: 1, o: {}, list: [] }
		const outcome = applied(
			document,
			"n=50000",
			's="50000"',
			"b=true",
			"z=null",
			'o={"a":1}',
			"list=[1,2]",
		)
		expect(outcome.document).toMatchObject({
			n: 50_000,
			s: "50000",
			b: true,
			z: null,
			o: { a: 1 },
			list: [1, 2],
		})
	})
})
