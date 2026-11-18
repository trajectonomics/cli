import { describe, expect, it } from "bun:test"
import type { CompareView } from "./projection/compare-view"
import type { FiView } from "./projection/fi-view"
import { dateFlags, fi, projection, projectionHome } from "./projection/testing"
import { runBody } from "./projection-run-support"
import { capture } from "./test-support"

/** A Contribution far beyond the cash the fixture plan has, so the engine cannot fund it. */
const TOO_BIG: readonly string[] = ["--set", "flows.invest.amount=20000000"]

describe("a Projection that could not fund a Contribution", () => {
	it("says so in the notes, so a what-if that changes nothing is not silent", async () => {
		const home = await projectionHome()
		const res = await projection(home, ["run", "--scenario", "base", ...dateFlags(), ...TOO_BIG])
		expect(res.code).toBe(0)
		expect(runBody(res).notes.join(" ")).toContain("of Contributions could not be funded")
	})

	it("names the side that could not fund it in a compare", async () => {
		const home = await projectionHome()
		const res = await projection(home, ["compare", "base", ...dateFlags(), ...TOO_BIG])
		expect(res.code).toBe(0)
		const body = JSON.parse(res.out) as CompareView
		expect(body.notes.join(" ")).toContain("Side B could not fund")
	})

	it("adds the same sentence to fi, whose Projection is the one it reports", async () => {
		const home = await projectionHome()
		const res = await fi(home, ["--scenario", "base", ...dateFlags(), ...TOO_BIG])
		expect(res.code).toBe(0)
		const body = JSON.parse(res.out) as FiView
		expect(body.notes.join(" ")).toContain("of Contributions could not be funded")
	})

	it("adds no sentence when every Contribution was funded", async () => {
		const home = await projectionHome()
		const body = runBody(await projection(home, ["run", "--scenario", "base", ...dateFlags()]))
		expect(body.notes.join(" ")).not.toContain("could not be funded")
	})

	it("names the Carry-in document's shape in the schema, not only in the README", async () => {
		const res = await capture(["schema", "projection", "run", "--json"])
		expect(res.code).toBe(0)
		const description = (
			JSON.parse(res.out) as {
				input: { properties: { carryIn: { description: string } } }
			}
		).input.properties.carryIn.description
		expect(description).toContain("periodStart")
		expect(description).toContain("rest")
	})
})
