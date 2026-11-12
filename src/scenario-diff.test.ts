import { describe, expect, it } from "bun:test"
import {
	applyScenario,
	errorOf,
	resultOf,
	rowOf,
	scenario,
	scenarioHome,
} from "./scenario-test-support"
import { SCENARIO_DOCUMENT } from "./store/testing"
import { capture } from "./test-support"

const A = SCENARIO_DOCUMENT
const [CASH, LOAN] = A.accounts
const BROKER = { id: "broker", kind: "asset", rate: 0 }

const B = {
	...A,
	currency: "USD",
	economy: { inflation: 100 },
	accounts: [{ ...CASH, rate: 250 }, BROKER],
}

type ChangeBody = { path: string; kind: string; before?: unknown; after?: unknown }

function changesOf(data: unknown): ChangeBody[] {
	return (data as { changes: ChangeBody[] }).changes
}

describe("scenario diff", () => {
	it("reports two equal documents, including a Scenario against itself, as identical", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", A)
		await applyScenario(home, "copy", A)
		for (const pair of [
			["base", "base"],
			["base", "copy"],
		]) {
			const res = await scenario(home, ["diff", ...pair])
			expect(res.code).toBe(0)
			const data = resultOf(res)
			expect(data.identical).toBe(true)
			expect(data.changes).toEqual([])
		}
	})

	it("names both refs and every added, removed and changed path", async () => {
		const home = scenarioHome()
		const a = rowOf(resultOf(await applyScenario(home, "a", A)))
		const b = rowOf(resultOf(await applyScenario(home, "b", B)))
		const data = resultOf(await scenario(home, ["diff", "a", "b"]))
		expect(data.identical).toBe(false)
		expect(data.a).toEqual({ id: a.id, name: "a", contentHash: a.contentHash })
		expect(data.b).toEqual({ id: b.id, name: "b", contentHash: b.contentHash })
		expect(changesOf(data)).toEqual([
			{ path: "accounts.broker", kind: "added", after: BROKER },
			{ path: "accounts.cash.rate", kind: "changed", before: CASH.rate, after: 250 },
			{ path: "accounts.loan", kind: "removed", before: LOAN },
			{ path: "currency", kind: "changed", before: "THB", after: "USD" },
			{ path: "economy.inflation", kind: "changed", before: 0, after: 100 },
		])
	})

	it("reports a reordered id list as one atomic change", async () => {
		const home = scenarioHome()
		const before = A
		const after = { ...A, accounts: [LOAN, CASH] }
		await applyScenario(home, "a", before)
		await applyScenario(home, "b", after)
		const changes = changesOf(resultOf(await scenario(home, ["diff", "a", "b"])))
		expect(changes).toEqual([
			{ path: "accounts", kind: "changed", before: [CASH, LOAN], after: [LOAN, CASH] },
		])
	})

	it("treats a list without ids as one value", async () => {
		const home = scenarioHome()
		const before = { ...A, cashflow: { ...A.cashflow, withdraw: ["cash"] } }
		const after = { ...A, cashflow: { ...A.cashflow, withdraw: [] } }
		await applyScenario(home, "a", before)
		await applyScenario(home, "b", after)
		const changes = changesOf(resultOf(await scenario(home, ["diff", "a", "b"])))
		expect(changes).toEqual([
			{ path: "cashflow.withdraw", kind: "changed", before: ["cash"], after: [] },
		])
	})

	it("sorts changes by unescaped segment and repeats byte for byte", async () => {
		const home = scenarioHome()
		await applyScenario(home, "a", A)
		await applyScenario(home, "b", {
			...A,
			currency: "USD",
			economy: { inflation: 100 },
			accounts: [{ ...CASH, rate: 250 }, LOAN],
		})
		const first = await scenario(home, ["diff", "a", "b"])
		const second = await scenario(home, ["diff", "a", "b"])
		expect(second.out).toBe(first.out)
		expect(changesOf(resultOf(first)).map((change) => change.path)).toEqual([
			"accounts.cash.rate",
			"currency",
			"economy.inflation",
		])
	})

	it("reports a missing side as not_found at a or b", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", A)
		const first = await scenario(home, ["diff", "nope", "base"])
		expect(first.code).toBe(4)
		expect(errorOf(first)).toMatchObject({
			code: "not_found",
			path: "a",
			details: { resource: "scenario" },
		})
		const second = await scenario(home, ["diff", "base", "nope"])
		expect(second.code).toBe(4)
		expect(errorOf(second)).toMatchObject({ code: "not_found", path: "b" })
	})

	it("is listed by the schema", async () => {
		const described = resultOf(await capture(["schema", "scenario", "diff", "--json"]))
		expect(described.name).toBe("scenario diff")
		expect(described.positionals).toEqual(["a", "b"])
	})
})
