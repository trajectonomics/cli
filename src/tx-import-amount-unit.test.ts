import { describe, expect, it } from "bun:test"
import { cli, csv, errorOf, HEADER, ledgerHome, row, seeded } from "./tx-import-test-support"

describe("the unit a rejected amount is reported in", () => {
	it("echoes the amount the person typed, never the core's minor units", async () => {
		const cases = [
			{ amount: "-500.00", code: "NEGATIVE_AMOUNT" },
			{ amount: "0.00", code: "ZERO_AMOUNT_POSTING" },
		]
		for (const entry of cases) {
			const home = ledgerHome()
			const traj = cli(home)
			await seeded(traj)
			const res = await traj([
				"tx",
				"import",
				csv(home, "unit.csv", [
					HEADER,
					row(["2026-03-01", "Cash", "Food", entry.amount, "", "u", ""]),
				]),
				"--json",
			])
			expect(res.code).toBe(3)
			const reason = errorOf(res).details.rows[0]?.reason
			expect(reason?.code).toBe(entry.code)
			expect(reason?.details).toMatchObject({ value: entry.amount })
		}
	})
})
