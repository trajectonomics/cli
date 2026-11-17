import { describe, expect, it } from "bun:test"
import {
	carryInFile,
	MID_PERIOD,
	TH_CLASSES,
	taxedHome,
	thRecord,
	zeroTallies,
} from "./projection/carry-in-support"
import { errorOf, projection, projectionHome } from "./projection/testing"
import { runBody, tableOf } from "./projection-run-support"

describe("a Projection starting inside a tax period", () => {
	it("refuses without the flag, at --carry-in, naming every class the Levy measures", async () => {
		const home = await taxedHome()
		const res = await projection(home, ["run", "--scenario", "base", ...MID_PERIOD])
		expect(res.code).toBe(2)
		const error = errorOf(res)
		expect(error).toMatchObject({ code: "invalid_input", path: "--carry-in" })
		expect(error.details).toEqual({
			levy: "th-2026-pit",
			periodStart: "2026-01-01",
			missing: TH_CLASSES,
		})
		expect(error.hint).toContain('"0.00"')
	})

	it("takes the stated Carry-in, applies its tax and echoes every amount", async () => {
		const home = await taxedHome()
		const none = await projection(home, [
			"run",
			"--scenario",
			"base",
			...MID_PERIOD,
			"--carry-in",
			carryInFile(home, [thRecord()]),
		])
		expect(none.code).toBe(0)
		const zero = tableOf(runBody(none), "annual").rows.at(-1)?.closingNetWorth
		const stated = await projection(home, [
			"run",
			"--scenario",
			"base",
			...MID_PERIOD,
			"--carry-in",
			carryInFile(home, [
				thRecord({
					tallies: [{ label: "income.section40_1", basis: "gross", amount: "100000.00" }],
					prepaid: "1000.00",
				}),
			]),
		])
		expect(stated.code).toBe(0)
		const body = runBody(stated)
		// The stated salary is taxed and the prepayment credited, so the year's tax is higher.
		expect(tableOf(body, "annual").rows.at(-1)?.closingNetWorth).not.toBe(zero)
		expect(Number(tableOf(body, "annual").rows.at(-1)?.closingNetWorth)).toBeLessThan(Number(zero))
		expect(body.carryIn).toEqual([
			{
				levy: "th-2026-pit",
				periodStart: "2026-01-01",
				// `rest` is echoed expanded: every class the Levy measures, the named one stated.
				tallies: TH_CLASSES.map(({ label, basis }) => ({
					label,
					basis,
					amount: label === "income.section40_1" ? "100000.00" : "0.00",
				})),
				prepaid: "1000.00",
				source: "flag",
			},
		])
		expect(body.notes.join(" ")).toContain("plus the stated Carry-in")
	})

	it("refuses a record that leaves a class out, and names the ones missing", async () => {
		const home = await taxedHome()
		const record = thRecord({
			rest: undefined,
			tallies: [{ label: "income.section40_1", basis: "gross", amount: "0.00" }],
		})
		const res = await projection(home, [
			"run",
			"--scenario",
			"base",
			...MID_PERIOD,
			"--carry-in",
			carryInFile(home, [record]),
		])
		expect(res.code).toBe(2)
		const error = errorOf(res)
		expect(error).toMatchObject({ code: "invalid_input", path: "document.0.tallies" })
		expect(error.details).toMatchObject({
			levy: "th-2026-pit",
			periodStart: "2026-01-01",
		})
		expect(
			(error.details as { missing: { label: string }[] }).missing.map((it) => it.label),
		).toEqual(TH_CLASSES.filter((it) => it.label !== "income.section40_1").map((it) => it.label))
		expect(error.hint).toContain('"rest": "0.00"')
	})
})

describe("a Projection starting on a period boundary", () => {
	it("needs no flag, and echoes the scope record the CLI writes", async () => {
		const home = await taxedHome()
		const res = await projection(home, [
			"run",
			"--scenario",
			"base",
			"--as-of",
			"2026-01-01",
			"--horizon",
			"2027-12-31",
		])
		expect(res.code).toBe(0)
		const body = runBody(res)
		expect(body.carryIn).toEqual([
			{
				levy: "th-2026-pit",
				periodStart: "2025-01-01",
				tallies: [],
				prepaid: "0.00",
				source: "scope",
			},
		])
		expect(body.notes.join(" ")).toContain("Tax before 2026 is not recomputed")
	})

	it("uses one the caller states, and does not claim it is not recomputed", async () => {
		const home = await taxedHome()
		const res = await projection(home, [
			"run",
			"--scenario",
			"base",
			"--as-of",
			"2026-01-01",
			"--horizon",
			"2027-12-31",
			"--carry-in",
			carryInFile(home, [
				thRecord({ periodStart: "2025-01-01", tallies: zeroTallies(), rest: undefined }),
			]),
		])
		expect(res.code).toBe(0)
		const body = runBody(res)
		expect(body.carryIn).toMatchObject([{ periodStart: "2025-01-01", source: "flag" }])
		expect(body.notes.join(" ")).not.toContain("not recomputed")
	})

	it("refuses a Levy this build did not emit instead of inventing its record", async () => {
		const home = await projectionHome()
		const res = await projection(home, [
			"run",
			"--scenario",
			"levied",
			"--as-of",
			"2026-01-01",
			"--horizon",
			"2027-03-30",
		])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "--carry-in" })
		expect(errorOf(res).message).toContain('Levy "national"')
		expect(errorOf(res).message).toContain("2025-01-01")
	})
})
