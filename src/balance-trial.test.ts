import { Database } from "bun:sqlite"
import { describe, expect, it } from "bun:test"
import { join } from "node:path"
import { FIXTURE_AS_OF, fixtureHome } from "./ledger-fixture"
import { golden } from "./report/testing"
import { capture } from "./test-support"

function balance(home: string, ...args: string[]) {
	return capture(["balance", "--as-of", FIXTURE_AS_OF, ...args, "--json"], { TRAJ_HOME: home })
}

/** Writes one posting's amount directly, the way a broken restore or a hand edit would. */
function corrupt(home: string, txId: string): void {
	const db = new Database(join(home, "traj.db"))
	db.run("UPDATE posting SET amount = amount + 1 WHERE tx_id = ?1 AND ordinal = 0", [txId])
	db.close()
}

const BROKEN = "0194b000-0007-7000-8000-000000000007"

describe("balance --trial-balance", () => {
	it("adds the Trial Balance to the same result as balance", async () => {
		const res = await balance(fixtureHome(), "--trial-balance")
		expect(res.code).toBe(0)
		expect(res.err).toBe("")
		expect(res.out).toBe(await golden("balance-trial.jsonl"))
	})

	it("gives one row per leaf Account with non-negative magnitudes whose totals agree", async () => {
		const data = JSON.parse((await balance(fixtureHome(), "--trial-balance")).out) as {
			trialBalance: {
				rows: { account: { name: string }; debit: string; credit: string; currency: string }[]
				totals: { currency: string; debit: string; credit: string }[]
			}
		}
		const { rows, totals } = data.trialBalance
		expect(rows.map((row) => row.account.name)).toEqual([
			"Bank",
			"Cash",
			"Food",
			"Investment",
			"Loan",
			"Locked",
			"Misc",
			"Old wallet",
			"Opening",
			"Salary",
			"Savings",
		])
		for (const row of rows) {
			expect(Number(row.debit)).toBeGreaterThanOrEqual(0)
			expect(Number(row.credit)).toBeGreaterThanOrEqual(0)
			expect(Number(row.debit) === 0 || Number(row.credit) === 0).toBe(true)
			expect(row.currency).toBe("THB")
		}
		expect(totals).toEqual([{ currency: "THB", debit: "1155000.00", credit: "1155000.00" }])
	})

	it("reports a tampered store as UNBALANCED_TRANSACTION, naming the transaction", async () => {
		for (const args of [[], ["--trial-balance"]]) {
			const home = fixtureHome()
			corrupt(home, BROKEN)
			const res = await balance(home, ...args)
			expect(res.code).toBe(3)
			expect(res.out).toBe("")
			expect(JSON.parse(res.err).error).toMatchObject({
				code: "UNBALANCED_TRANSACTION",
				exitCode: 3,
				path: `transactions.${BROKEN}`,
				details: { field: "postings" },
			})
		}
	})

	it("declares no code the registry does not hold", async () => {
		const res = await capture(["schema", "balance", "--json"])
		const codes = JSON.parse(res.out).errorCodes as string[]
		expect(codes).not.toContain("internal")
		expect(codes).not.toContain("invalid_input")
		const listing = JSON.parse((await capture(["schema", "--json"])).out)
		const registryCodes = listing.errors.map((entry: { code: string }) => entry.code)
		for (const code of codes) expect(registryCodes).toContain(code)
	})
})
