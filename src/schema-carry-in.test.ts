import { describe, expect, it } from "bun:test"
import { CARRY_IN_EXAMPLE, carryInDocument } from "./projection/carryin"
import { capture } from "./test-support"
import { ledgerHome } from "./tx-test-support"

type JsonSchema = Record<string, unknown>

/** `traj schema <path> --json`, whose `flagDocuments` publish the documents a flag names. */
async function flagDocumentOf(path: readonly string[], flag: string): Promise<JsonSchema> {
	const res = await capture(["schema", ...path, "--json"], { TRAJ_HOME: ledgerHome() })
	expect(res.code).toBe(0)
	const detail = JSON.parse(res.out) as { flagDocuments?: { flag: string; schema: JsonSchema }[] }
	const published = (detail.flagDocuments ?? []).find((entry) => entry.flag === flag)
	if (published === undefined)
		throw new Error(`no ${flag} document published for ${path.join(" ")}`)
	return published.schema
}

/** The `items` of the record list, with its properties and its required fields. */
function recordOf(schema: JsonSchema): {
	properties: Record<string, { description?: string; items?: JsonSchema }>
	required: string[]
} {
	return (schema["items"] ?? {}) as {
		properties: Record<string, { description?: string; items?: JsonSchema }>
		required: string[]
	}
}

describe("the --carry-in document in traj schema", () => {
	it("publishes the record shape on every leaf that reads one", async () => {
		for (const path of [["projection", "run"], ["projection", "compare"], ["fi"]]) {
			const record = recordOf(await flagDocumentOf(path, "carryIn"))
			expect(Object.keys(record.properties)).toEqual([
				"scenario",
				"levy",
				"periodStart",
				"tallies",
				"prepaid",
				"rest",
			])
			expect(record.required).toEqual(["scenario", "levy", "periodStart", "tallies", "prepaid"])
			expect(record.properties["prepaid"]?.description).toContain("decimal string")
		}
	})

	it("publishes the bases a tally takes, so a plan does not guess one", async () => {
		const record = recordOf(await flagDocumentOf(["projection", "run"], "carryIn"))
		const tally = JSON.stringify(record.properties["tallies"]?.["items"])
		for (const basis of ["gross", "funded", "returns", "gains"]) expect(tally).toContain(basis)
	})

	it("publishes an example the same schema accepts", async () => {
		const schema = await flagDocumentOf(["projection", "run"], "carryIn")
		expect(schema["examples"]).toEqual([CARRY_IN_EXAMPLE])
		expect(carryInDocument.safeParse(CARRY_IN_EXAMPLE).success).toBe(true)
	})
})
