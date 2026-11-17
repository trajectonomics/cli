import { describe, expect, it } from "bun:test"
import { carryInFile, MID_PERIOD, taxedHome, thRecord } from "./projection/carry-in-support"
import { errorOf, fi, projection, projectionHome } from "./projection/testing"
import { capture } from "./test-support"

describe("the other two leaves", () => {
	it("echoes the Carry-in per side of a compare", async () => {
		const home = await projectionHome()
		const res = await projection(home, [
			"compare",
			"levied",
			"levied",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2027-03-30",
		])
		expect(res.code).toBe(0)
		const body = JSON.parse(res.out) as {
			sides: { a: { carryIn?: unknown[] }; b: { carryIn?: unknown[] } }
		}
		expect(body.sides.a.carryIn).toMatchObject([{ levy: "national", source: "document" }])
		expect(body.sides.b.carryIn).toEqual(body.sides.a.carryIn)
	})

	it("echoes the Carry-in on fi", async () => {
		const home = await taxedHome()
		const res = await fi(home, [
			"--scenario",
			"base",
			...MID_PERIOD,
			"--carry-in",
			carryInFile(home, [thRecord()]),
		])
		expect(res.code).toBe(0)
		expect((JSON.parse(res.out) as { carryIn?: unknown[] }).carryIn).toMatchObject([
			{ levy: "th-2026-pit", source: "flag" },
		])
	})
})

describe("the flag's contract", () => {
	it("is described by `traj schema`, on all three leaves", async () => {
		for (const command of ["projection run", "projection compare", "fi"]) {
			const res = await capture(["schema", ...command.split(" "), "--json"])
			expect(res.code).toBe(0)
			const data = JSON.parse(res.out) as { input: { properties: Record<string, unknown> } }
			expect(Object.keys(data.input.properties)).toContain("carryIn")
		}
	})

	it("refuses a document that is not a list of records", async () => {
		const home = await taxedHome()
		const res = await projection(home, [
			"run",
			"--scenario",
			"base",
			...MID_PERIOD,
			"--carry-in",
			carryInFile(home, { scenario: "base" }),
		])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input" })
	})

	it("reads the document from stdin when the flag is -, as every document is (ADR-0020)", async () => {
		const home = await taxedHome()
		const res = await capture(
			["projection", "run", "--scenario", "base", ...MID_PERIOD, "--carry-in", "-", "--json"],
			{ TRAJ_HOME: home },
			undefined,
			JSON.stringify([thRecord()]),
		)
		expect(res.code).toBe(0)
		expect((JSON.parse(res.out) as { carryIn?: unknown[] }).carryIn).toMatchObject([
			{ levy: "th-2026-pit", source: "flag" },
		])
	})

	it("reuses the base's record on both sides of a what-if", async () => {
		const home = await projectionHome()
		const res = await projection(home, [
			"compare",
			"levied",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2027-03-30",
			"--set",
			"flows.salary.amount=90000",
		])
		expect(res.code).toBe(0)
		const body = JSON.parse(res.out) as {
			sides: { a: { carryIn?: unknown[] }; b: { carryIn?: unknown[] } }
		}
		// One record, two sides: a what-if is the same Scenario projected with one Override.
		expect(body.sides.b.carryIn).toEqual(body.sides.a.carryIn)
		expect(body.sides.a.carryIn).toMatchObject([{ periodStart: "2026-01-01", source: "document" }])
	})
})
