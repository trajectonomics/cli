import { describe, expect, it } from "bun:test"
import { applyScenario, scenarioHome } from "./scenario-test-support"
import { SENTENCES } from "./sentences"
import { SCENARIO_DOCUMENT } from "./store/testing"
import { capture, type ErrorBody, errorOf } from "./test-support"
import { accounts, cli, ledgerHome } from "./tx-test-support"

const BANK = { account: "Bank", amount: "1.00", currency: "THB" }
const SALARY = { account: "Salary", amount: "-1.00", currency: "THB" }

async function documentOf(body: unknown): Promise<ErrorBody> {
	const home = ledgerHome()
	const traj = cli(home)
	await accounts(traj, [
		["Bank", "asset"],
		["Salary", "income"],
	])
	const res = await cli(home, JSON.stringify(body))(["tx", "add", "--postings", "-", "--json"])
	return errorOf(res)
}

describe("document-form failures", () => {
	it("names a missing document field with the required-field sentence", async () => {
		const error = await documentOf({ postings: [BANK, SALARY] })
		expect(error).toMatchObject({
			path: "document.date",
			message: SENTENCES.requiredField,
			details: [{ path: "document.date", message: SENTENCES.requiredField }],
		})
		expect(error.hint).toBeUndefined()
	})

	it("gives a wrong-typed field the document-shape sentence", async () => {
		const error = await documentOf({ date: 123, postings: [BANK, SALARY] })
		expect(error).toMatchObject({ path: "document.date", message: SENTENCES.documentShape })
		expect(error.hint).toBeUndefined()
	})

	it("names one row per unexpected key, under its container and index", async () => {
		const error = await documentOf({
			date: "2026-03-31",
			nope: 1,
			postings: [{ ...BANK, extra: 2 }, SALARY],
		})
		expect(error.message).toBe(SENTENCES.unexpectedField)
		expect(error.details).toEqual([
			{ path: "document.postings.0.extra", message: SENTENCES.unexpectedField },
			{ path: "document.nope", message: SENTENCES.unexpectedField },
		])
	})

	it("keeps the posting index in a document path", async () => {
		const error = await documentOf({
			date: "2026-03-31",
			postings: [{ account: "Bank", currency: "THB" }, SALARY],
		})
		expect(error).toMatchObject({
			path: "document.postings.0.amount",
			message: SENTENCES.requiredField,
		})
	})

	it("names the document flag when the file cannot be read, with the help hint", async () => {
		const home = ledgerHome()
		await accounts(cli(home), [
			["Bank", "asset"],
			["Salary", "income"],
		])
		const error = errorOf(await cli(home)(["tx", "add", "--postings", "/nope.json", "--json"]))
		expect(error).toMatchObject({
			path: "--postings",
			message: 'Cannot read the document at "/nope.json"',
			hint: 'Run "traj help tx add" to see its flags.',
		})
	})
})

describe("a core owns its own codes and sentences", () => {
	it("keeps sim-core's code, path and sentence for a Scenario document", async () => {
		const home = scenarioHome()
		const res = await applyScenario(home, "base", { schemaVersion: 0 })
		expect(res.code).toBe(2)
		const error = errorOf(res)
		expect(error).toMatchObject({
			path: "document.schemaVersion",
			details: [
				{
					path: "document.schemaVersion",
					code: "UNSUPPORTED_SCHEMA_VERSION",
				},
			],
		})
		expect(error.message).toContain("document.schemaVersion: UNSUPPORTED_SCHEMA_VERSION")
		expect(error.hint).toBe('Run "traj schema scenario apply" to see the document schema.')
	})
})

describe("object details pass through untouched", () => {
	it("keeps inspect's table list", async () => {
		const error = errorOf(await capture(["inspect", "nope", "--json"], { TRAJ_HOME: ledgerHome() }))
		expect(error.path).toBe("table")
		expect(error.details).toHaveProperty("tables")
		expect(Array.isArray((error.details as { tables?: unknown }).tables)).toBe(true)
	})

	it("keeps a --set failure's own details", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", SCENARIO_DOCUMENT)
		const res = await capture(
			["scenario", "fork", "base", "early", "--set", "flows.salery.amount=1", "--json"],
			{ TRAJ_HOME: home },
		)
		expect(errorOf(res)).toMatchObject({
			path: "--set",
			details: { index: 0, path: "flows.salery.amount", segment: "salery" },
		})
	})

	it("keeps the Levy's label list", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", SCENARIO_DOCUMENT)
		const res = await capture(
			["scenario", "tax", "base", "--tax", "th-2026", "--label", "salary=bogus", "--json"],
			{ TRAJ_HOME: home },
		)
		const details = errorOf(res).details as { labels?: unknown }
		expect(Array.isArray(details?.labels)).toBe(true)
	})
})
