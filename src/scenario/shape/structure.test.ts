import { describe, expect, it } from "bun:test"
import { scenarioExample } from "./index"
import { documented, PROPERTIES, refusalsOf, replaceAt, resolves, VERSION } from "./testing"

/*
 * The structure the published document shape states, proved against the pinned core: every path it
 * documents is one a document carries and every object it closes is one the core refuses an
 * unknown key in. The required fields have their own file, `required.test.ts`.
 */

const FULL: Record<string, unknown> = {
	...scenarioExample(VERSION ?? 0),
	accounts: [
		{ id: "cash", kind: "asset", rate: 150 },
		{ id: "index", kind: "asset", rate: 600, compounding: "annual", gainLabel: "gains.index" },
		{ id: "pension", kind: "asset", rate: 400, lockedUntil: "2051-01-01" },
		{ id: "gold", kind: "asset", rate: 200, returnLabel: "returns.gold" },
		{ id: "loan", kind: "liability", rate: 500 },
	],
	flows: [
		{
			id: "salary",
			kind: "income",
			earned: true,
			label: "income.section40_1",
			amount: 100_000,
			frequency: "monthly",
			start: "2026-01-01",
			growth: "inflation",
			prepayments: [{ levy: "th-2026", bps: 500 }],
			cappedPrepayment: { levy: "th-2026", bps: 500, upTo: "cap" },
		},
		{
			id: "bonus",
			kind: "income",
			earned: false,
			amount: 5_000,
			frequency: "annual",
			start: "2026-01-01",
			end: "2046-01-01",
			growth: { bps: 200 },
		},
		{
			id: "rent",
			kind: "expense",
			amount: 20_000,
			frequency: "monthly",
			start: "2026-01-01",
			growth: { bps: 0 },
		},
		{
			id: "once",
			kind: "expense",
			amount: 1,
			frequency: "once",
			start: "2026-02-01",
			growth: { bps: 0 },
		},
		{
			id: "invest",
			kind: "contribution",
			target: "index",
			amount: 10_000,
			frequency: "monthly",
			start: "2026-01-01",
			growth: "inflation",
		},
		{
			id: "pay",
			kind: "contribution",
			target: "loan",
			amount: 5_000,
			frequency: "monthly",
			start: "2026-01-01",
			growth: "inflation",
		},
		{
			id: "derived",
			kind: "expense",
			frequency: "monthly",
			start: "2026-01-01",
			derive: { measures: [{ id: "base", op: "const", value: 100 }], result: "base" },
		},
	],
	cashflow: {
		surplus: [{ account: "cash", upTo: 500_000 }, { account: "index" }],
		contribute: ["index", "gold"],
		withdraw: ["cash"],
	},
	levies: [
		{
			id: "th-2026",
			period: { month: 1, day: 1 },
			settlement: { month: 4, day: 30 },
			measures: [
				{ id: "cap", op: "const", value: 500_000 },
				{ id: "gross", op: "tally", label: "income.section40_1", basis: "gross" },
				{ id: "returns", op: "tally", label: "returns.gold", basis: "returns" },
				{ id: "gains", op: "tally", label: "gains.index", basis: "gains" },
				{ id: "due", op: "const", value: 0 },
			],
			due: "due",
			carryIn: [{ periodStart: "2025-01-01", tallies: [], prepaid: 0 }],
		},
	],
	calendar: { dayRule: "next", holidays: ["2026-04-13"] },
}

/** Every object the schema states as closed, as a path into `FULL`, so each is probed closed. */
const OBJECT_PATHS: (string | number)[][] = [
	[],
	["economy"],
	["accounts", 0],
	["flows", 0],
	["flows", 0, "prepayments", 0],
	["flows", 0, "cappedPrepayment"],
	["flows", 6, "derive"],
	["cashflow"],
	["cashflow", "surplus", 0],
	["levies", 0],
	["levies", 0, "period"],
	["levies", 0, "settlement"],
	["calendar"],
]

/** The objects whose keys a Measure's own `op` decides, which the schema states as open. */
const OPEN_OBJECTS = ["flows.*.derive.measures.*"]

describe("the published Scenario document shape", () => {
	it("states every path in a document the pin accepts", () => {
		expect(refusalsOf(FULL)).toEqual([])
		const unresolved = documented()
			.filter((entry) => !resolves(FULL, entry.path))
			.map((entry) => entry.path.join("."))
		expect(unresolved).toEqual([])
	})

	it("pins schemaVersion to the one the core accepts", () => {
		expect(VERSION).toBeDefined()
		expect(PROPERTIES["schemaVersion"]).toMatchObject({ const: VERSION })
		expect(refusalsOf({ ...FULL, schemaVersion: (VERSION ?? 0) + 1 })).toEqual([
			{ code: "UNSUPPORTED_SCHEMA_VERSION", path: "schemaVersion" },
		])
	})

	it("closes every object it documents, as the core does", () => {
		const objects = documented().filter((entry) => entry.node["properties"] !== undefined)
		expect(objects).toHaveLength(OBJECT_PATHS.length - 1 + OPEN_OBJECTS.length)
		for (const entry of objects) {
			const open = OPEN_OBJECTS.includes(
				entry.path
					.map((s) => String(s))
					.join(".")
					.replaceAll(/\d+/g, "*"),
			)
			expect(entry.node["additionalProperties"]).toBe(open ? undefined : false)
		}
		for (const path of OBJECT_PATHS) {
			const target = path.reduce<unknown>(
				(current, segment) => (current as Record<string, never>)[String(segment)],
				FULL,
			)
			const mutated = replaceAt(FULL, path, {
				...(target as Record<string, unknown>),
				noSuchKey: 1,
			})
			expect(refusalsOf(mutated)).toContainEqual({
				code: "UNKNOWN_KEY",
				path: [...path, "noSuchKey"].join("."),
			})
		}
	})

	it("publishes an example the pin accepts and stamps with its version", () => {
		const example = scenarioExample(VERSION ?? 0)
		expect(refusalsOf(example)).toEqual([])
		expect(example["schemaVersion"]).toBe(VERSION)
	})
})
