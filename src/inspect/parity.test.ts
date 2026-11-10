import { describe, expect, it } from "bun:test"
import { goldenHome, goldenJsonl } from "../interchange/testing"
import { capture } from "../test-support"

describe("inspect --json matches the canonical JSONL", () => {
	it("carries the same keys and values as the export's records", async () => {
		const res = await capture(["inspect", "--all", "--json"], { TRAJ_HOME: await goldenHome() })
		const inspect = JSON.parse(res.out).tables
		const [header, ...records] = (await goldenJsonl())
			.trimEnd()
			.split("\n")
			.map((line) => JSON.parse(line))
		expect(header.record).toBe("header")
		const exported = Map.groupBy(records, (record: { record: string }) => record.record)
		for (const table of inspect) {
			const expected = (exported.get(table.name) ?? []).map(
				({ record: _record, ...row }: Record<string, unknown>) => row,
			)
			const actual = table.rows.map((row: Record<string, unknown>) =>
				table.name === "scenario"
					? { ...row, document: JSON.parse(row["document"] as string) }
					: row,
			)
			expect({ name: table.name, rows: actual }).toEqual({ name: table.name, rows: expected })
			expect(table.count).toBe(table.rows.length)
		}
	})
})
