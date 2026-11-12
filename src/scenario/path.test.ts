import { describe, expect, it } from "bun:test"
import { SCENARIO_DOCUMENT } from "../store/testing"
import { overrideSegments } from "./path"

describe("overrideSegments", () => {
	it("addresses a list item by its unique id", () => {
		expect(overrideSegments(SCENARIO_DOCUMENT, ["flows", 0, "amount"])).toEqual([
			"flows",
			"salary",
			"amount",
		])
	})

	it("cuts a list without a unique id back to the list's own path", () => {
		expect(overrideSegments(SCENARIO_DOCUMENT, ["cashflow", "surplus", 0, "upTo"])).toEqual([
			"cashflow",
			"surplus",
		])
		const duplicated = { list: [{ id: "a" }, { id: "a" }] }
		expect(overrideSegments(duplicated, ["list", 1])).toEqual(["list"])
	})
})
