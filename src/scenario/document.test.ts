import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { applyScenario, errorOf, scenarioHome } from "../scenario-test-support"
import { canonicalScenarioDocument } from "../store"
import { SCENARIO_DOCUMENT } from "../store/testing"
import { acceptedScenarioSchemaVersion, scenarioDocumentError, scenarioProblems } from "./document"
import { scenarioTemplate } from "./template"

const SALARY = SCENARIO_DOCUMENT.flows[0]
const VALID = SCENARIO_DOCUMENT

describe("scenarioProblems", () => {
	it("accepts a valid Scenario when the Timeline is absent", () => {
		expect(scenarioProblems(VALID)).toEqual([])
	})

	it("keeps sim-core's codes and order, with a list index as a number", () => {
		const document = {
			...VALID,
			flows: [{ ...SALARY, nope: 1, amount: -1 }, ...VALID.flows.slice(1)],
		}
		expect(scenarioProblems(document)).toEqual([
			{ code: "UNKNOWN_KEY", segments: ["flows", 0, "nope"] },
			{ code: "NEGATIVE_AMOUNT", segments: ["flows", 0, "amount"] },
		])
	})

	it("reports a non-object and an unsupported schemaVersion by sim-core's codes", () => {
		expect(scenarioProblems([])).toEqual([{ code: "NOT_AN_OBJECT", segments: [] }])
		expect(scenarioProblems({ ...VALID, schemaVersion: 2 })).toEqual([
			{ code: "UNSUPPORTED_SCHEMA_VERSION", segments: ["schemaVersion"] },
		])
	})
})

describe("scenarioDocumentError", () => {
	it("builds invalid_input at the caller's base, with every problem in details", () => {
		const document = {
			...VALID,
			flows: [{ ...SALARY, nope: 1, amount: -1 }, ...VALID.flows.slice(1)],
		}
		const error = scenarioDocumentError(document, "line.24.document")
		if (error === null) throw new Error("the document was accepted")
		expect(error.body).toEqual({
			code: "invalid_input",
			exitCode: 2,
			path: "line.24.document.flows.0.nope",
			message: "line.24.document.flows.0.nope: UNKNOWN_KEY",
			details: [
				{
					path: "line.24.document.flows.0.nope",
					message: "line.24.document.flows.0.nope: UNKNOWN_KEY",
					code: "UNKNOWN_KEY",
				},
				{
					path: "line.24.document.flows.0.amount",
					message: "line.24.document.flows.0.amount: NEGATIVE_AMOUNT",
					code: "NEGATIVE_AMOUNT",
				},
			],
		})
	})

	it("returns null for a document sim-core accepts", () => {
		expect(scenarioDocumentError(VALID)).toBeNull()
	})
})

describe("scenario document validation", () => {
	const HINT = 'Run "traj schema scenario apply" to see the document schema.'

	it("reports a non-object the same way from the document form and the store", async () => {
		const cli = errorOf(await applyScenario(scenarioHome(), "base", "[]"))
		expect(cli).toEqual({
			code: "invalid_input",
			exitCode: 2,
			path: "document",
			message: "document: NOT_AN_OBJECT",
			details: [{ path: "document", message: "document: NOT_AN_OBJECT", code: "NOT_AN_OBJECT" }],
		})
		const stored = canonicalScenarioDocument([])
		if (!isAppError(stored)) throw new Error("the store accepted a non-object")
		expect(cli).toEqual(JSON.parse(JSON.stringify(stored.body)))
	})

	it("names the accepted version on an unsupported one, in the form and the store", async () => {
		const home = scenarioHome()
		const accepted = acceptedScenarioSchemaVersion()
		for (const document of ['{"a":1}', '{"schemaVersion":"1"}', '{"schemaVersion":0}']) {
			const path = "document.schemaVersion"
			const message = `${path}: UNSUPPORTED_SCHEMA_VERSION (the accepted version is ${accepted})`
			const cli = errorOf(await applyScenario(home, "base", document))
			expect(cli).toEqual({
				code: "invalid_input",
				exitCode: 2,
				path,
				message,
				hint: HINT,
				details: [{ path, message, code: "UNSUPPORTED_SCHEMA_VERSION" }],
			})
			const stored = canonicalScenarioDocument(JSON.parse(document))
			if (!isAppError(stored)) throw new Error(`the store accepted ${document}`)
			expect(cli).toEqual(JSON.parse(JSON.stringify(stored.body)))
		}
	})

	it("keeps the caller's path for an imported document", () => {
		const accepted = acceptedScenarioSchemaVersion()
		const stored = canonicalScenarioDocument({ schemaVersion: 0 }, "line.24.document")
		if (!isAppError(stored)) throw new Error("the store accepted the document")
		expect(stored.body).toMatchObject({
			code: "invalid_input",
			path: "line.24.document.schemaVersion",
			message: `line.24.document.schemaVersion: UNSUPPORTED_SCHEMA_VERSION (the accepted version is ${accepted})`,
			hint: HINT,
			details: [{ code: "UNSUPPORTED_SCHEMA_VERSION" }],
		})
	})
})

describe("the accepted Scenario schemaVersion", () => {
	it("is the version the pinned core accepts, and the one the fixture carries", () => {
		expect(acceptedScenarioSchemaVersion()).toBe(SCENARIO_DOCUMENT.schemaVersion)
	})

	it("prints the template's exact bytes, so a diff shows the wire contract", () => {
		const accepted = acceptedScenarioSchemaVersion()
		expect(scenarioTemplate()).toBe(`{
  "schemaVersion": ${accepted},
  "currency": "THB",
  "economy": {
    "inflation": 0
  },
  "accounts": [
    {
      "id": "cash",
      "kind": "asset",
      "rate": 0
    }
  ],
  "flows": [
    {
      "id": "salary",
      "kind": "income",
      "earned": true,
      "amount": 100000,
      "frequency": "monthly",
      "start": "2026-01-01",
      "growth": "inflation"
    }
  ],
  "cashflow": {
    "surplus": [
      {
        "account": "cash"
      }
    ],
    "contribute": [],
    "withdraw": []
  }
}`)
	})

	it("stamps the template, which is a document the core accepts", () => {
		const text = scenarioTemplate()
		if (text === undefined) throw new Error("the pinned core accepted no version")
		const document = JSON.parse(text)
		expect(document.schemaVersion).toBe(acceptedScenarioSchemaVersion())
		expect(scenarioProblems(document)).toEqual([])
	})
})
