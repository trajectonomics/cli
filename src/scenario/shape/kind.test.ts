import { describe, expect, it } from "bun:test"
import { scenarioExample } from "./index"
import { nodeAt, type Path, refusalsOf, VERSION } from "./testing"

/*
 * The keys the shape states for one kind only. Each is a claim in a description ("Assets only",
 * "Income only", "Contribution only"), so each is probed: the core refuses that key on the other
 * kind, at that key. A key the kind's own shape does not declare is UNKNOWN_KEY; one the Flow shape
 * declares but that kind does not use is FIELD_NOT_ALLOWED.
 */

const VERSION_NUMBER = VERSION ?? 0
const CASH = { id: "cash", kind: "asset", rate: 0 }
const EXPENSE = { id: "flow", kind: "expense", amount: 1, frequency: "monthly", growth: { bps: 0 } }

/** A Scenario with the Accounts and Flows a probe needs, and the Levy that makes a label readable. */
function documentOf(input: {
	accounts?: Record<string, unknown>[]
	flows?: Record<string, unknown>[]
}): Record<string, unknown> {
	return {
		...scenarioExample(VERSION_NUMBER),
		accounts: input.accounts ?? [CASH],
		flows: (input.flows ?? [EXPENSE]).map((flow) => ({ start: "2026-01-01", ...flow })),
		cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: [] },
		levies: [
			{
				id: "th-2026",
				period: { month: 1, day: 1 },
				settlement: { month: 4, day: 30 },
				measures: [{ id: "due", op: "const", value: 0 }],
				due: "due",
			},
		],
	}
}

/** One Account key only an asset may carry: its path, the description that says so, its value. */
const ASSET_ONLY: { key: string; value: unknown; statement: string }[] = [
	{ key: "lockedUntil", value: "2051-01-01", statement: "Assets only" },
	{ key: "returnLabel", value: "returns.index", statement: "Assets only" },
	{ key: "gainLabel", value: "gains.index", statement: "Assets only" },
]

/** One Flow key a kind refuses, with the code the core uses for that kind's own shape. */
const FLOW_KIND_ONLY: {
	key: string
	value: unknown
	statement: string
	code: string
}[] = [
	{ key: "earned", value: true, statement: "Income only", code: "UNKNOWN_KEY" },
	{ key: "target", value: "cash", statement: "Contribution only", code: "UNKNOWN_KEY" },
	{
		key: "label",
		value: "income.section40_1",
		statement: "Income and contribution only",
		code: "FIELD_NOT_ALLOWED",
	},
	{ key: "prepayments", value: [], statement: "Income only", code: "FIELD_NOT_ALLOWED" },
	{
		key: "cappedPrepayment",
		value: { levy: "th-2026", bps: 500, upTo: "due" },
		statement: "Income only",
		code: "FIELD_NOT_ALLOWED",
	},
]

describe("the keys the shape states for one kind only", () => {
	it("says which kind each of them belongs to, in its own description", () => {
		for (const entry of ASSET_ONLY) {
			expect(String(nodeAt(["accounts", 0, entry.key])["description"])).toContain(entry.statement)
		}
		for (const entry of FLOW_KIND_ONLY) {
			expect(String(nodeAt(["flows", 0, entry.key])["description"])).toContain(entry.statement)
		}
	})

	it("refuses an asset-only key on a liability, at that key", () => {
		for (const entry of ASSET_ONLY) {
			const refusals = refusalsOf(
				documentOf({
					accounts: [CASH, { id: "loan", kind: "liability", rate: 500, [entry.key]: entry.value }],
				}),
			)
			const path: Path = ["accounts", 1, entry.key]
			expect(refusals).toContainEqual({
				code: "LIABILITY_MISUSE",
				path: path.join("."),
			})
		}
	})

	it("refuses a Flow key on a kind that does not take it, at that key", () => {
		for (const entry of FLOW_KIND_ONLY) {
			const refusals = refusalsOf(documentOf({ flows: [{ ...EXPENSE, [entry.key]: entry.value }] }))
			expect(refusals).toContainEqual({
				code: entry.code,
				path: ["flows", 0, entry.key].join("."),
			})
		}
	})
})
