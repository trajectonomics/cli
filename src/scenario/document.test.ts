import { describe, expect, it } from "bun:test"
import { check, type Problem } from "@trajectonomics/sim"
import { isAppError } from "../errors"
import { applyScenario, errorOf, scenarioHome } from "../scenario-test-support"
import { canonicalScenarioDocument } from "../store"
import {
	documentPath,
	overrideSegments,
	type ScenarioProblem,
	scenarioDocumentError,
	scenarioProblems,
} from "./document"

const NEUTRAL_BASELINE = { schemaVersion: 1, balances: [] }

/** The `scenario.` problems of one `check()` call, with the prefix stripped. */
function scenarioPrefix(problems: readonly Problem[]): ScenarioProblem[] {
	return problems
		.filter((problem) => problem.path[0] === "scenario")
		.map((problem) => ({ code: problem.code, segments: problem.path.slice(1) }))
}

const SALARY = {
	id: "salary",
	kind: "income",
	earned: true,
	frequency: "monthly",
	start: "2026-01-01",
	amount: 100_000,
	growth: "inflation",
}

const VALID = {
	schemaVersion: 4,
	currency: "THB",
	economy: { inflation: 0 },
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
	flows: [SALARY],
	cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: ["cash"] },
}

describe("scenarioProblems", () => {
	it("accepts a valid Scenario when the Timeline is absent", () => {
		expect(scenarioProblems(VALID)).toEqual([])
	})

	it("keeps sim-core's codes and order, with a list index as a number", () => {
		const document = {
			...VALID,
			flows: [{ ...SALARY, nope: 1, amount: -1 }],
		}
		expect(scenarioProblems(document)).toEqual([
			{ code: "UNKNOWN_KEY", segments: ["flows", 0, "nope"] },
			{ code: "NEGATIVE_AMOUNT", segments: ["flows", 0, "amount"] },
		])
	})

	it("reports a non-object and an unsupported schemaVersion by sim-core's codes", () => {
		expect(scenarioProblems([])).toEqual([{ code: "NOT_AN_OBJECT", segments: [] }])
		expect(scenarioProblems({ ...VALID, schemaVersion: 1 })).toEqual([
			{ code: "UNSUPPORTED_SCHEMA_VERSION", segments: ["schemaVersion"] },
		])
	})
})

describe("scenarioDocumentError", () => {
	it("builds invalid_input at the caller's base, with every problem in details", () => {
		const document = { ...VALID, flows: [{ ...SALARY, nope: 1, amount: -1 }] }
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

describe("overrideSegments", () => {
	it("addresses a list item by its unique id", () => {
		expect(overrideSegments(VALID, ["flows", 0, "amount"])).toEqual(["flows", "salary", "amount"])
	})

	it("cuts a list without a unique id back to the list's own path", () => {
		expect(overrideSegments(VALID, ["cashflow", "surplus", 0, "upTo"])).toEqual([
			"cashflow",
			"surplus",
		])
		const duplicated = { list: [{ id: "a" }, { id: "a" }] }
		expect(overrideSegments(duplicated, ["list", 1])).toEqual(["list"])
	})

	it("is the document path the CLI prints for a list index", () => {
		expect(documentPath("document", ["flows", 0, "amount"])).toBe("document.flows.0.amount")
	})
})

describe("scenario document validation", () => {
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
			message: "line.24.document.schemaVersion: UNSUPPORTED_SCHEMA_VERSION",
			details: [{ code: "UNSUPPORTED_SCHEMA_VERSION" }],
		})
	})
})

describe("the scenario problems that depend on the Baseline or Timeline", () => {
	// The validator gives `check()` an empty Baseline and no Timeline. This pins the one exception
	// that makes that safe: besides `MISSING_CARRY_IN`, a `scenario.*` problem never depends on the
	// other two inputs, so validating a document alone cannot disagree with `project()`.
	const WITH_LEVY = {
		...VALID,
		flows: [{ ...SALARY, label: "inc" }],
		levies: [
			{
				id: "tax",
				period: { month: 1, day: 1 },
				settlement: { month: 4, day: 1 },
				measures: [{ id: "due", op: "tally", label: "inc", basis: "gross" }],
				due: "due",
			},
		],
	}
	const INVALID: readonly [string, unknown][] = [
		["a Levy with no carry-in", WITH_LEVY],
		["an unknown flow key", { ...VALID, flows: [{ ...SALARY, nope: 1 }] }],
		["a missing cashflow", { ...VALID, cashflow: undefined }],
		["a negative amount", { ...VALID, flows: [{ ...SALARY, amount: -1 }] }],
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

	it("are only MISSING_CARRY_IN", () => {
		for (const [name, document] of INVALID) {
			const expected = scenarioProblems(document)
			for (const baseline of BASELINES) {
				for (const timeline of TIMELINES) {
					const found = scenarioPrefix(check(baseline, document, timeline)).filter(
						(problem) => problem.code !== "MISSING_CARRY_IN",
					)
					expect({ name, found }).toEqual({ name, found: expected })
				}
			}
		}
	})
})
