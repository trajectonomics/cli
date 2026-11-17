import { describe, expect, it } from "bun:test"
import { carryInFile, taxedHome, thRecord } from "./projection/carry-in-support"
import { errorOf, fi, projection, projectionHome } from "./projection/testing"
import { runBody, tableOf } from "./projection-run-support"
import { scenario } from "./scenario-test-support"

describe("a taxed Projection", () => {
	it("fills the Carry-in the As-of implies, and says the earlier tax is not recomputed", async () => {
		const home = await taxedHome()
		// The tax year starts the same day, so the Projection is charged for the whole of 2026; the
		// previous year's Settlement still falls inside it, and the CLI states what that means.
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
		const notes = runBody(res).notes
		expect(notes.join(" ")).toContain("Tax before 2026 is not recomputed")
		expect(notes.join(" ")).not.toContain("not the whole year")
	})

	it("reports a Levy the caller wrote as applied, and names it", async () => {
		const home = await projectionHome()
		// The fixture "levied" Scenario states its own Levy and Carry-in, so nothing is injected...
		const body = runBody(
			await projection(home, [
				"run",
				"--scenario",
				"levied",
				"--as-of",
				"2026-03-31",
				"--horizon",
				"2027-03-30",
			]),
		)
		// ...and the tax it states is the tax the figures carry, whatever wrote the Levy (ADR-0032).
		expect(body.tax).toBe("applied")
		const notes = body.notes.join(" ")
		expect(notes).not.toContain("No tax is applied")
		expect(notes).toContain('Levy "national"')
		// The claim is not cosmetic: the 3 % at source is already out of this figure.
		expect(tableOf(body, "annual").rows.at(-1)?.closingNetWorth).toBe("1586723.96")
	})

	it("names every Levy the Scenario holds, and no jurisdiction it cannot see", async () => {
		const home = await projectionHome()
		// One document with this build's Levy and a caller's: both are the Scenario's own rule sets.
		const document = {
			...JSON.parse((await scenario(home, ["show", "levied"])).out).scenario.document,
		}
		const [national] = document.levies as Record<string, unknown>[]
		const applied = await scenario(
			home,
			["apply", "two-levies", "--file", "-"],
			JSON.stringify({
				...document,
				levies: [
					{ ...national, id: "th-2026-pit" },
					{ ...national, id: "national" },
				],
			}),
		)
		expect(applied.code).toBe(0)
		const notes = runBody(
			await projection(home, [
				"run",
				"--scenario",
				"two-levies",
				"--as-of",
				"2026-03-31",
				"--horizon",
				"2027-03-30",
			]),
		).notes.join(" ")
		expect(notes).toContain('Levy "th-2026-pit"')
		expect(notes).toContain('Levy "national"')
	})

	it("refuses a Levy the CLI did not emit when the As-of leaves a period open", async () => {
		const home = await projectionHome()
		// A caller's own Levy with no Carry-in is the caller's to state: the CLI refuses it at the
		// flag that states one rather than letting the engine be the first to notice (ADR-0032).
		const document = {
			...JSON.parse((await scenario(home, ["show", "levied"])).out).scenario.document,
		}
		const levies = (document.levies as Record<string, unknown>[]).map(
			({ carryIn: _carryIn, ...levy }) => ({ ...levy, id: "national" }),
		)
		const applied = await scenario(
			home,
			["apply", "own-levy", "--file", "-"],
			JSON.stringify({ ...document, levies }),
		)
		expect(applied.code).toBe(0)
		const res = await projection(home, [
			"run",
			"--scenario",
			"own-levy",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2027-03-30",
		])
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({ code: "invalid_input", path: "--carry-in" })
	})

	it("keeps both sides' notes when both are taxed, each naming its own Levy", async () => {
		const home = await taxedHome()
		// Side A is this build's Levy, which leaves 2025's Settlement open; side B states its own
		// Levy and its own record, so neither side's sentences may be dropped in favour of the other.
		const res = await projection(home, [
			"compare",
			"levied",
			"base",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2027-03-30",
			"--carry-in",
			carryInFile(home, [thRecord()]),
		])
		expect(res.code).toBe(0)
		const notes = (JSON.parse(res.out) as { notes: string[] }).notes.join(" ")
		expect(notes).toContain('Levy "national"')
		expect(notes).toContain('Levy "th-2026-pit"')
		expect(notes).toContain("Tax before 2026 is not recomputed")
	})

	it("reports mixed when one side of a compare is taxed, and says the deltas include it", async () => {
		const home = await projectionHome()
		const mixed = await projection(home, [
			"compare",
			"base",
			"levied",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2027-03-30",
		])
		expect(mixed.code).toBe(0)
		const body = JSON.parse(mixed.out) as { tax: string; notes: string[] }
		expect(body.tax).toBe("mixed")
		const notes = body.notes.join(" ")
		expect(notes).toContain("the Deltas between the two sides include the tax")
		// The deltas are after-tax, so the untaxed side's sentence would contradict them.
		expect(notes).not.toContain("No tax is applied")
		expect(notes).toContain('Levy "national"')
		const both = await projection(home, [
			"compare",
			"levied",
			"levied",
			"--as-of",
			"2026-03-31",
			"--horizon",
			"2027-03-30",
		])
		expect(both.code).toBe(0)
		expect((JSON.parse(both.out) as { tax: string }).tax).toBe("applied")
	})

	it("applies the same tax to the FI date", async () => {
		const home = await taxedHome()
		const res = await fi(home, [
			"--scenario",
			"base",
			"--as-of",
			"2026-01-01",
			"--horizon",
			"2060-12-31",
		])
		expect(res.code).toBe(0)
		expect(runBody(res).tax).toBe("applied")
	})
})
