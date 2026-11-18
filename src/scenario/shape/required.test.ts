import { describe, expect, it } from "bun:test"
import { SCENARIO_SHAPE_REQUIRED, scenarioExample } from "./index"
import { documented, type Path, refusalsOf, replaceAt, VERSION } from "./testing"

/*
 * Every field the published shape calls required, probed against the pinned core: a document
 * without it must be refused there. The probe walks the shape's own `required` arrays, so a nested
 * one (`flows.*.growth`, say) is pinned by the same test as a top-level key. A required field the
 * core refuses in a context where an optional one applies would fail here, which is how publishing
 * `growth` as unconditionally required on a Flow was caught.
 */

const EXAMPLE = scenarioExample(VERSION ?? 0)
const SALARY = (EXAMPLE["flows"] as Record<string, unknown>[])[0] as Record<string, unknown>

/**
 * The example plus the corners it leaves out, so every documented object has one instance: the
 * Levy, the Calendar, the two prepayment shapes, and a derived amount. The core accepts it.
 */
const FULL: Record<string, unknown> = {
	...EXAMPLE,
	flows: [
		{
			...SALARY,
			label: "income.section40_1",
			prepayments: [{ levy: "th-2026", bps: 500 }],
			cappedPrepayment: { levy: "th-2026", bps: 500, upTo: "cap" },
		},
		{
			id: "derived",
			kind: "expense",
			frequency: "monthly",
			start: "2026-01-01",
			derive: { measures: [{ id: "base", op: "const", value: 100 }], result: "base" },
		},
	],
	levies: [
		{
			id: "th-2026",
			period: { month: 1, day: 1 },
			settlement: { month: 4, day: 30 },
			measures: [
				{ id: "cap", op: "const", value: 500_000 },
				{ id: "gross", op: "tally", label: "income.section40_1", basis: "gross" },
				{ id: "due", op: "const", value: 0 },
			],
			due: "due",
		},
	],
	calendar: { dayRule: "exact", holidays: [] },
}

/** Every path a documented `*` reaches, with each array index written out. */
function concrete(value: unknown, path: Path): Path[] {
	if (path.length === 0) return value === undefined ? [] : [[]]
	const [head, ...rest] = path
	if (head === undefined) return []
	if (head === "*") {
		const items = Array.isArray(value) ? value : []
		return items.flatMap((item, at) => concrete(item, rest).map((found) => [at, ...found]))
	}
	if (typeof value !== "object" || value === null) return []
	return concrete((value as Record<string, unknown>)[head as string], rest).map((found) => [
		head,
		...found,
	])
}

/** The object at a path whose indices are written out. */
function objectAt(document: unknown, path: Path): Record<string, unknown> {
	return path.reduce<unknown>(
		(current, segment) => (current as Record<string, unknown>)[String(segment)],
		document,
	) as Record<string, unknown>
}

/** The document with one key deleted from the object at `path`. */
function withoutKey(document: unknown, path: Path, key: string): unknown {
	const target = { ...objectAt(document, path) }
	delete target[key]
	return replaceAt(document, path, target)
}

/** Every documented object that states a `required` list, with each instance `FULL` holds. */
const REQUIREMENTS = documented()
	.filter((entry) => Array.isArray(entry.node["required"]))
	.map((entry) => ({
		path: entry.path,
		required: entry.node["required"] as string[],
		instances: concrete(FULL, entry.path),
	}))

/** Every instance of every object, paired with each key the shape calls required there. */
function requiredPairs(): { instance: Path; key: string }[] {
	return REQUIREMENTS.flatMap((entry) =>
		entry.instances.flatMap((instance) => entry.required.map((key) => ({ instance, key }))),
	)
}

describe("the required fields the shape states", () => {
	it("covers every object that states one, in a document that carries it", () => {
		const objects = documented().filter((entry) => Array.isArray(entry.node["required"]))
		expect(REQUIREMENTS).toHaveLength(objects.length)
		for (const entry of REQUIREMENTS) {
			expect(entry.instances.length, entry.path.join(".")).toBeGreaterThan(0)
		}
	})

	it("is carried by every instance of that object in a document the pin accepts", () => {
		for (const { instance, key } of requiredPairs()) {
			expect(objectAt(FULL, instance), `${instance.join(".")}.${key}`).toHaveProperty(key)
		}
	})

	it("states the document's own keys in the core's order", () => {
		expect(SCENARIO_SHAPE_REQUIRED).toEqual([
			"schemaVersion",
			"currency",
			"economy",
			"accounts",
			"flows",
			"cashflow",
		])
	})

	it("refuses a document missing any key it calls required", () => {
		expect(refusalsOf(FULL)).toEqual([])
		for (const { instance, key } of requiredPairs()) {
			// A missing version is the core's own UNSUPPORTED_SCHEMA_VERSION, not MISSING_KEY.
			const code = key === "schemaVersion" ? "UNSUPPORTED_SCHEMA_VERSION" : "MISSING_KEY"
			expect(
				refusalsOf(withoutKey(FULL, instance, key)),
				`${instance.join(".")}.${key}`,
			).toContainEqual({ code, path: [...instance, key].join(".") })
		}
	})

	it("states the one-of rule a Flow's amount, growth and derive follow", () => {
		const flow = (patch: Record<string, unknown>) => ({
			...FULL,
			flows: [{ id: "flow", kind: "expense", frequency: "monthly", start: "2026-01-01", ...patch }],
		})
		const growth = { bps: 0 }
		const derive = { measures: [{ id: "base", op: "const", value: 100 }], result: "base" }
		expect(refusalsOf(flow({ derive }))).toEqual([])
		expect(refusalsOf(flow({ amount: 1, growth }))).toEqual([])
		expect(refusalsOf(flow({ amount: 1, growth, derive }))).toContainEqual({
			code: "FIELD_NOT_ALLOWED",
			path: "flows.0.derive",
		})
		expect(refusalsOf(flow({ derive, growth }))).toContainEqual({
			code: "FIELD_NOT_ALLOWED",
			path: "flows.0.growth",
		})
		expect(refusalsOf(flow({}))).toContainEqual({ code: "MISSING_KEY", path: "flows.0.amount" })
	})
})
