import { describe, expect, it } from "bun:test"
import { check, type Problem } from "@trajectonomics/sim"
import { isAppError } from "../errors"
import { applyScenario, errorOf, SCENARIO_DOCUMENT, scenarioHome } from "../scenario-test-support"
import { canonicalScenarioDocument } from "../store"
import { scenarioDocumentError, scenarioProblems } from "./document"

const NEUTRAL_BASELINE = { schemaVersion: 1, balances: [] }

/** The problems `check()` reports under `scenario.`, the only ones a document can own. */
function scenarioOnly(problems: readonly Problem[]): Problem[] {
	return problems.filter((problem) => problem.path[0] === "scenario")
}

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
	it("reports the same path, message and details from the document form and the store", async () => {
		const home = scenarioHome()
		const cases: [string, string, string][] = [
			["[]", "document", "NOT_AN_OBJECT"],
			['{"a":1}', "document.schemaVersion", "UNSUPPORTED_SCHEMA_VERSION"],
			['{"schemaVersion":"1"}', "document.schemaVersion", "UNSUPPORTED_SCHEMA_VERSION"],
			['{"schemaVersion":0}', "document.schemaVersion", "UNSUPPORTED_SCHEMA_VERSION"],
		]
		for (const [document, path, code] of cases) {
			const message = `${path}: ${code}`
			const cli = errorOf(await applyScenario(home, "base", document))
			expect(cli).toEqual({
				code: "invalid_input",
				exitCode: 2,
				path,
				message,
				details: [{ path, message, code }],
			})
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
			message: "line.24.document.schemaVersion: UNSUPPORTED_SCHEMA_VERSION",
			details: [{ code: "UNSUPPORTED_SCHEMA_VERSION" }],
		})
	})
})

describe("the scenario problems that depend on the Baseline or Timeline", () => {
	// The validator gives `check()` an empty Baseline and no Timeline. This pins the property that
	// makes that safe: no `scenario.*` problem depends on the other two inputs. Scenario v1 has no
	// Levy and so no Timeline-dependent Scenario problem; the validator's `MISSING_CARRY_IN`
	// exclusion is the forward guard for a later Scenario version.
	const INVALID: readonly [string, unknown][] = [
		["an unknown flow key", { ...VALID, flows: [{ ...SALARY, nope: 1 }, ...VALID.flows.slice(1)] }],
		["a missing cashflow", { ...VALID, cashflow: undefined }],
		[
			"a negative amount",
			{ ...VALID, flows: [{ ...SALARY, amount: -1 }, ...VALID.flows.slice(1)] },
		],
		["a duplicate account id", { ...VALID, accounts: [VALID.accounts[0], VALID.accounts[0]] }],
	]
	const BASELINES: readonly unknown[] = [
		NEUTRAL_BASELINE,
		{ schemaVersion: 1, balances: [{ account: "cash", amount: 150_000 }] },
		{ schemaVersion: 1, balances: [{ account: "missing", amount: 1 }] },
	]
	const TIMELINES: readonly unknown[] = [
		{ start: "2026-01-01", horizon: "2026-12-31", resolution: "month" },
		{ start: "2026-06-15", horizon: "2027-06-15", resolution: "day" },
		{ start: "2025-01-01", horizon: "2030-01-01", resolution: "month" },
	]

	it("never change a scenario problem", () => {
		for (const [name, document] of INVALID) {
			const expected = scenarioOnly(check(NEUTRAL_BASELINE, document, null))
			for (const baseline of BASELINES) {
				for (const timeline of TIMELINES) {
					const found = scenarioOnly(check(baseline, document, timeline))
					expect({ name, found }).toEqual({ name, found: expected })
				}
			}
		}
	})
})
