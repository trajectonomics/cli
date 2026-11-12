import { describe, expect, it } from "bun:test"
import { SCENARIO_DOCUMENT } from "../store/testing"
import type { ScenarioProblem } from "./document"
import { type AppliedOverride, documentFailure } from "./set-error"

const PROBLEM: ScenarioProblem = { code: "NEGATIVE_AMOUNT", segments: ["flows", 0, "amount"] }

function overrides(...paths: string[]): AppliedOverride[] {
	return paths.map((path) => ({ path, value: 1 }))
}

describe("documentFailure", () => {
	it("names the failing document path and sim-core's code in the set's error", () => {
		const error = documentFailure(overrides("flows.salary.amount"), [PROBLEM], SCENARIO_DOCUMENT)
		expect(error.body).toMatchObject({
			code: "invalid_input",
			path: "set",
			message:
				"set: the document is invalid after the overrides: document.flows.0.amount: NEGATIVE_AMOUNT",
			details: {
				index: 0,
				path: "flows.salary.amount",
				documentPath: "document.flows.0.amount",
				code: "NEGATIVE_AMOUNT",
			},
		})
	})

	it("attributes a problem to the last set whose path covers it", () => {
		const error = documentFailure(
			overrides("flows.salary", "flows.salary.amount"),
			[PROBLEM],
			SCENARIO_DOCUMENT,
		)
		expect(error.body.details).toMatchObject({ index: 1, path: "flows.salary.amount" })
	})

	it("falls back to the last set when no set path covers the problem", () => {
		const error = documentFailure(overrides("economy.inflation"), [PROBLEM], SCENARIO_DOCUMENT)
		expect(error.body.details).toMatchObject({
			index: 0,
			path: "economy.inflation",
			documentPath: "document.flows.0.amount",
		})
	})

	it("reports the first problem a set covers, not merely the first problem", () => {
		const uncovered: ScenarioProblem = {
			code: "UNKNOWN_ACCOUNT",
			segments: ["cashflow", "surplus", 0, "account"],
		}
		const error = documentFailure(
			overrides("flows.salary.amount"),
			[uncovered, PROBLEM],
			SCENARIO_DOCUMENT,
		)
		expect(error.body.details).toMatchObject({
			index: 0,
			path: "flows.salary.amount",
			documentPath: "document.flows.0.amount",
		})
	})

	it("matches a list without a unique id at the list's own path", () => {
		const problem: ScenarioProblem = { code: "UNKNOWN_KEY", segments: ["cashflow", "surplus", 0] }
		const error = documentFailure(overrides("cashflow.surplus"), [problem], SCENARIO_DOCUMENT)
		expect(error.body.details).toMatchObject({
			index: 0,
			path: "cashflow.surplus",
			documentPath: "document.cashflow.surplus.0",
		})
	})
})
