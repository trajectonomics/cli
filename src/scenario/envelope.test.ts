import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { applyScenario, errorOf, scenarioHome } from "../scenario-test-support"
import { canonicalScenarioDocument } from "../store"

describe("scenario envelope", () => {
	it("reports the same path, message and details from the document form and the store", async () => {
		const home = scenarioHome()
		for (const document of ["[]", '{"a":1}', '{"schemaVersion":"1"}', '{"schemaVersion":0}']) {
			const cli = errorOf(await applyScenario(home, "base", document))
			const stored = canonicalScenarioDocument(JSON.parse(document))
			if (!isAppError(stored)) throw new Error(`the store accepted ${document}`)
			expect(cli).toEqual(JSON.parse(JSON.stringify(stored.body)))
		}
	})

	it("keeps the caller's path for an imported document", () => {
		const stored = canonicalScenarioDocument({ schemaVersion: 0 }, "line.24.document")
		if (!isAppError(stored)) throw new Error("the store accepted the document")
		expect(stored.body).toMatchObject({
			code: "invalid_input",
			path: "line.24.document.schemaVersion",
			message: "line.24.document.schemaVersion: must be a positive integer",
		})
	})
})
