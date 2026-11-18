import { describe, expect, it } from "bun:test"
import { scenarioExample } from "./index"
import {
	canonical,
	documented,
	nodeAt,
	type Path,
	probed,
	refusalsOf,
	replaceAt,
	VERSION,
} from "./testing"

/*
 * Every closed value set the published shape states, probed against the pinned core: each value it
 * lists is one the core accepts in that position, and a value outside the set is refused there by
 * the code the core uses. The last test keeps this table in step with the schema, so a value set
 * added to the document cannot ship without a probe.
 */

const CASH = { id: "cash", kind: "asset", rate: 0 }
const EXPENSE = { kind: "expense", amount: 1, frequency: "monthly", growth: { bps: 0 } }

/** A Scenario with one Flow and the Accounts it needs, so one field is the only difference. */
function probe(input: {
	flow: Record<string, unknown>
	accounts?: Record<string, unknown>[]
}): Record<string, unknown> {
	return {
		...scenarioExample(VERSION ?? 0),
		accounts: input.accounts ?? [CASH],
		flows: [{ id: "flow", start: "2026-01-01", ...input.flow }],
		cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: [] },
	}
}

type EnumProbe = {
	path: Path
	/** One document per listed value, or none when the full document already carries them all. */
	accepted: () => unknown[]
	code: string
	bad: string
}

const PROBES: EnumProbe[] = [
	{
		path: ["accounts", 0, "kind"],
		accepted: () =>
			(nodeAt(["accounts", 0, "kind"])["enum"] as string[]).map((kind) =>
				probe({ flow: EXPENSE, accounts: [{ id: "probe", kind, rate: 0 }, CASH] }),
			),
		code: "INVALID_KIND",
		bad: "bond",
	},
	{
		path: ["accounts", 1, "compounding"],
		accepted: () =>
			(nodeAt(["accounts", 1, "compounding"])["enum"] as string[]).map((compounding) =>
				probe({ flow: EXPENSE, accounts: [{ id: "cash", kind: "asset", rate: 100, compounding }] }),
			),
		code: "INVALID_COMPOUNDING",
		bad: "daily",
	},
	{
		path: ["flows", 0, "kind"],
		accepted: () => [],
		code: "INVALID_KIND",
		bad: "bonus",
	},
	{
		path: ["flows", 0, "frequency"],
		accepted: () =>
			(nodeAt(["flows", 0, "frequency"])["enum"] as string[]).map((frequency) =>
				probe({ flow: { ...EXPENSE, frequency } }),
			),
		code: "INVALID_FREQUENCY",
		bad: "hourly",
	},
	{
		path: ["flows", 6, "derive", "measures", 0, "op"],
		accepted: () => [],
		code: "INVALID_OP",
		bad: "nope",
	},
	{
		path: ["calendar", "dayRule"],
		accepted: () =>
			(nodeAt(["calendar", "dayRule"])["enum"] as string[]).map((dayRule) => ({
				...scenarioExample(VERSION ?? 0),
				calendar: { dayRule, holidays: [] },
			})),
		code: "INVALID_DAY_RULE",
		bad: "nearest",
	},
]

/** The document every probe starts from: the example, with enough Flows to reach each field. */
const FULL: Record<string, unknown> = {
	...scenarioExample(VERSION ?? 0),
	accounts: [
		{ id: "cash", kind: "asset", rate: 0 },
		{ id: "index", kind: "asset", rate: 600, compounding: "annual" },
	],
	flows: [
		{ id: "salary", ...EXPENSE, start: "2026-01-01" },
		{ id: "rent", ...EXPENSE, start: "2026-01-01" },
		{ id: "once", ...EXPENSE, start: "2026-01-01" },
		{ id: "invest", ...EXPENSE, start: "2026-01-01" },
		{ id: "pay", ...EXPENSE, start: "2026-01-01" },
		{ id: "bonus", ...EXPENSE, start: "2026-01-01" },
		{
			id: "derived",
			kind: "expense",
			frequency: "monthly",
			start: "2026-01-01",
			derive: { measures: [{ id: "base", op: "const", value: 100 }], result: "base" },
		},
	],
	cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: [] },
	calendar: { dayRule: "exact", holidays: [] },
}

describe("the closed value sets the shape states", () => {
	it("covers every one of them with a probe", () => {
		const enums = documented().filter((entry) => Array.isArray(entry.node["enum"]))
		expect(enums.map((entry) => canonical(entry.path)).sort()).toEqual(
			PROBES.map((entry) => canonical(entry.path)).sort(),
		)
	})

	it("states every value each set accepts, and only those", () => {
		for (const entry of PROBES) {
			const values = nodeAt(entry.path)["enum"] as unknown[]
			expect(values).toContain(
				entry.path.reduce<unknown>(
					(current, segment) => (current as Record<string, unknown>)[String(segment)],
					FULL,
				),
			)
			const documents = entry.accepted()
			if (documents.length === 0) continue
			expect(documents).toHaveLength(values.length)
			for (const document of documents) expect(refusalsOf(document)).toEqual([])
		}
	})

	it("refuses a value outside each set it states, at that field", () => {
		for (const entry of PROBES) {
			expect(refusalsOf(replaceAt(FULL, entry.path, entry.bad))).toContainEqual({
				code: entry.code,
				path: probed(entry.path),
			})
		}
	})
})
