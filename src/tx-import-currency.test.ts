import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { join } from "node:path"
import { PERSONAL_ENTITY_ID } from "./store"
import {
	cli,
	csv,
	errorOf,
	HEADER,
	ledgerSize,
	row,
	seeded,
	tempHome,
} from "./tx-import-test-support"

describe("tx import currency", () => {
	it("rejects a currency mismatch at the row's from column", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seeded(traj)
		// v1's CLI and store create THB accounts only, so the second currency comes from the DB.
		const db = new Database(join(home, "traj.db"))
		db.run(
			`INSERT INTO account (id, entity_id, name, type, currency, version, created_at, updated_at)
			VALUES (?1, ?2, 'Dollars', 'asset', 'USD', 1, ?3, ?3)`,
			["01940000-0000-7000-8000-00000000c0de", PERSONAL_ENTITY_ID, "2026-01-01T00:00:00.000Z"],
		)
		db.close()
		const file = csv(home, "currency.csv", [
			HEADER,
			row(["2026-03-01", "Dollars", "Food", "1", "", "c", ""]),
		])
		const res = await traj(["tx", "import", file, "--json"])
		expect(res.code).toBe(3)
		expect(errorOf(res)).toMatchObject({
			code: "CURRENCY_MISMATCH",
			exitCode: 3,
			path: "line.2.from",
			details: { rows: [{ line: 2, reason: { code: "CURRENCY_MISMATCH" } }] },
		})
		expect(await ledgerSize(traj)).toEqual({ transactions: 0, postings: 0 })
	})
})
