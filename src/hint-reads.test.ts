import { describe, expect, it } from "bun:test"
import { ACCOUNT_HINT, TRANSACTION_HINT } from "./hint"
import { FIXTURE_AS_OF, fixtureHome } from "./ledger-fixture"
import { account, cli, ledgerHome } from "./tx-test-support"

type Read = string[]

const EMPTY_READS: Read[] = [
	["account", "list"],
	["tx", "list"],
	["balance", "--as-of", "2026-01-01"],
	["report", "networth", "--as-of", "2026-01-01"],
	["report", "pnl", "--until", "2026-01-01"],
]

const REPORTS: Read[] = [
	["balance", "--as-of", "2026-01-01"],
	["report", "networth", "--as-of", "2026-01-01"],
	["report", "pnl", "--until", "2026-01-01"],
]

const SCHEMA_PATHS: Read[] = [
	["init"],
	["account", "list"],
	["tx", "list"],
	["balance"],
	["report", "networth"],
	["report", "pnl"],
]

function data(res: { out: string }): Record<string, unknown> {
	return JSON.parse(res.out) as Record<string, unknown>
}

describe("a dead-end read names the next command", () => {
	it("names the first account on every read of an empty Ledger", async () => {
		const traj = cli(ledgerHome())
		for (const read of EMPTY_READS) {
			const res = await traj([...read, "--json"])
			expect(res.code).toBe(0)
			expect(data(res)["hint"]).toBe(ACCOUNT_HINT)
			expect((await traj(read)).out.split("\n").at(-1)).toBe(`hint: ${ACCOUNT_HINT}`)
		}
	})

	it("names tx add once the chart exists and the Ledger holds no Transaction", async () => {
		const traj = cli(ledgerHome())
		await account(traj, "Cash")
		await account(traj, "Food", "expense")
		expect(data(await traj(["tx", "list", "--json"]))["hint"]).toBe(TRANSACTION_HINT)
		for (const read of REPORTS) {
			const res = await traj([...read, "--json"])
			expect((data(res)["rows"] as unknown[]).length).toBeGreaterThan(0)
			expect((await traj(read)).out).not.toContain("hint:")
		}
	})

	it("says nothing on a populated Ledger, even before its first Transaction", async () => {
		const traj = cli(fixtureHome())
		const reads = [
			...EMPTY_READS,
			["balance", "--as-of", "2025-12-31", "--trial-balance"],
			// Empty because a filter matched nothing, not because the store is empty.
			["tx", "list", "--since", "2030-01-01"],
		]
		for (const read of reads) {
			const res = await traj([...read, "--json"])
			expect(res.code).toBe(0)
			expect(data(res)["hint"]).toBeUndefined()
			expect((await traj(read)).out).not.toContain("hint:")
		}
	})

	it("prints the hint as the last line, under the keys the answer already had", async () => {
		const traj = cli(ledgerHome())
		expect((await traj(["account", "list"])).out.split("\n")).toEqual([
			"accounts:",
			`hint: ${ACCOUNT_HINT}`,
		])
		expect((await traj(["balance", "--as-of", FIXTURE_AS_OF])).out.split("\n")).toEqual([
			`asOf: ${FIXTURE_AS_OF}`,
			"rows:",
			"netWorth:",
			`hint: ${ACCOUNT_HINT}`,
		])
	})

	it("publishes the field in the schema of every command that can be a dead end", async () => {
		const traj = cli(ledgerHome())
		for (const path of SCHEMA_PATHS) {
			const output = data(await traj(["schema", ...path, "--json"]))["output"] as {
				properties: Record<string, { description: string }>
			}
			expect(output.properties["hint"]?.description).toContain("The command")
		}
	})
})
