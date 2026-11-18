import { describe, expect, it } from "bun:test"
import { scenarioExample } from "./index"
import { nodeAt, type Path, refusalsOf, VERSION } from "./testing"

/*
 * The two things a person reads before writing a document: the unit of every number, and one
 * document that uses them. The example is the shape's `examples[0]`, so it is the same text
 * `traj schema scenario apply` prints.
 */

type Account = { kind?: string; compounding?: string; lockedUntil?: string }
type Flow = { kind?: string; growth?: unknown }

const EXAMPLE = scenarioExample(VERSION ?? 0) as {
	accounts: Account[]
	flows: Flow[]
	cashflow: { surplus: unknown[]; contribute: string[]; withdraw: string[] }
}

describe("the unit of every number the shape states", () => {
	it("is named in the description of the field that holds it", () => {
		const units: [Path, string][] = [
			[["flows", 0, "amount"], "minor units"],
			[["cashflow", "surplus", 0, "upTo"], "minor units"],
			[["accounts", 0, "rate"], "basis points"],
			[["economy", "inflation"], "basis points"],
			[["flows", 0, "growth"], "bps"],
		]
		for (const [path, unit] of units) {
			expect(String(nodeAt(path)["description"])).toContain(unit)
		}
	})
})

describe("the worked example", () => {
	it("is a document the pin accepts, stamped with the version the pin takes", () => {
		expect(refusalsOf(EXAMPLE)).toEqual([])
		expect(EXAMPLE).toMatchObject({ schemaVersion: VERSION })
	})

	it("teaches every kind, every rate form and both growth forms", () => {
		const kinds = EXAMPLE.accounts.map((account) => account.kind)
		expect(kinds).toContain("asset")
		expect(kinds).toContain("liability")
		expect(EXAMPLE.accounts.some((account) => account.compounding !== undefined)).toBe(true)
		expect(EXAMPLE.accounts.some((account) => account.lockedUntil !== undefined)).toBe(true)
		const flows = EXAMPLE.flows.map((flow) => flow.kind)
		expect(flows).toEqual(expect.arrayContaining(["income", "expense", "contribution"]))
		expect(EXAMPLE.flows.map((flow) => flow.growth)).toEqual(
			expect.arrayContaining(["inflation", { bps: 200 }]),
		)
		expect(EXAMPLE.cashflow.surplus.length).toBeGreaterThan(0)
		expect(EXAMPLE.cashflow.contribute.length).toBeGreaterThan(0)
		expect(EXAMPLE.cashflow.withdraw.length).toBeGreaterThan(0)
	})
})
