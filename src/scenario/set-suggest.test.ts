import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { applyOverrides } from "./set-apply"

type Doc = Record<string, unknown>

function failed(document: Doc, ...sets: string[]) {
	const outcome = applyOverrides(document, sets)
	if (!isAppError(outcome)) throw new Error(`accepted ${sets.join(" ")}`)
	return outcome.body
}

describe("applyOverrides suggestions", () => {
	it("suggests the nearest key and breaks a tie lexicographically", () => {
		const body = failed({ schemaVersion: 1, ab: 1, ac: 1 }, "ad=1")
		expect(body.details).toMatchObject({ segment: "ad", suggestion: "ab" })
	})

	it("suggests a path only when the distance is within max(2, floor(len / 3))", () => {
		const document = { schemaVersion: 1, "123456789": 1 }
		expect(failed(document, "123456000=1").details).toMatchObject({ suggestion: "123456789" })
		expect(failed(document, "123450000=1").details).toMatchObject({ suggestion: null })
	})

	it("lists at most ten known siblings and counts the rest", () => {
		const document: Doc = { schemaVersion: 1 }
		for (let index = 0; index < 12; index += 1) document[`key-${index}`] = index
		const body = failed(document, "zzzzzzzzzzzzz=1")
		expect(body.details).toMatchObject({ suggestion: null })
		expect(body.hint).toContain("key-0")
		expect(body.hint).toContain("and 3 more")
	})

	it("suggests a corrected path that keeps the caller's remaining segments", () => {
		const document = { schemaVersion: 1, goal: { amount: 1 } }
		const body = failed(document, "goel.amount=2")
		expect(body.details).toMatchObject({ suggestion: "goal.amount" })
		expect(body.hint).toContain('Did you mean "goal.amount"?')
	})

	it("reports the longest existing prefix when the path ends on a value", () => {
		const document = { schemaVersion: 1, goal: { amount: 1 } }
		const body = failed(document, "goal.amount.x=2")
		expect(body.details).toMatchObject({ segment: "goal.amount", suggestion: null })
	})
})

describe("applyOverrides envelope", () => {
	it("reports a set that leaves the document outside the envelope", () => {
		const body = failed({ schemaVersion: 1 }, "schemaVersion=0")
		expect(body).toMatchObject({
			code: "invalid_input",
			path: "set",
			details: { index: 0, path: "schemaVersion", documentPath: "document.schemaVersion" },
		})
	})

	it("names the set that broke the document, not merely the last one", () => {
		const body = failed({ schemaVersion: 1, a: 1 }, 'a="x"', 'schemaVersion="1"')
		expect(body.details).toMatchObject({ index: 1, path: "schemaVersion" })
	})
})
