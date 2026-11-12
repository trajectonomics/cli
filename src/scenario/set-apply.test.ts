import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { SCENARIO_DOCUMENT } from "../store/testing"
import { applyScenarioSets } from "./set-apply"

describe("applyScenarioSets", () => {
	it("leaves a fork with no sets to the Store, which reports an old row at its document path", () => {
		const stale = { draft: true }
		const outcome = applyScenarioSets(stale, [])
		if (isAppError(outcome)) throw new Error(JSON.stringify(outcome.body))
		expect(outcome).toEqual({ document: stale, overrides: [] })
	})

	it("refuses a final document sim-core rejects, at the set that covers the problem", () => {
		const outcome = applyScenarioSets(SCENARIO_DOCUMENT, ["flows.salary.amount=-1"])
		if (!isAppError(outcome)) throw new Error("the document was accepted")
		expect(outcome.body).toMatchObject({
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
})
