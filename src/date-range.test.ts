import { describe, expect, it } from "bun:test"
import { fixtureHome } from "./ledger-fixture"
import { capture } from "./test-support"
import { amend, cli, ledgerHome, lunch } from "./tx-test-support"

/** The error `error` object of a captured failure. */
function errorOf(res: { err: string }): { code: string; path?: string; message: string } {
	return JSON.parse(res.err).error
}

describe("a date outside the supported Gregorian years", () => {
	it("refuses the date of a transaction write, so a Buddhist year is not stored", async () => {
		const traj = cli(ledgerHome())
		const res = await traj([
			"tx",
			"add",
			"--from",
			"Cash",
			"--to",
			"Food",
			"--amount",
			"1.00",
			"--date",
			"2569-03-01",
			"--json",
		])
		expect(res.code).toBe(3)
		expect(errorOf(res)).toMatchObject({ code: "INVALID_DATE", path: "date" })
		expect(errorOf(res).message).toContain("1900-2100")
	})

	it("refuses a void reversal date and an amend reversal date", async () => {
		const traj = cli(ledgerHome())
		const { original } = await lunch(traj)
		const voided = await traj(["tx", "void", original.id, "--date", "2569-03-02", "--json"])
		expect(voided.code).toBe(3)
		expect(errorOf(voided)).toMatchObject({ code: "INVALID_DATE", path: "date" })
		const amended = await amend(traj, original.id, ["--void-date", "2569-03-02"])
		expect(amended.code).toBe(3)
		expect(errorOf(amended)).toMatchObject({ code: "INVALID_DATE", path: "voidDate" })
	})

	it("refuses a report As-of and its period dates", async () => {
		const home = fixtureHome()
		const networth = await capture(["report", "networth", "--as-of", "2569-03-31", "--json"], {
			TRAJ_HOME: home,
		})
		expect(networth.code).toBe(3)
		expect(errorOf(networth)).toMatchObject({ code: "INVALID_DATE", path: "asOf" })
		const balance = await capture(["balance", "--as-of", "2569-03-31", "--json"], {
			TRAJ_HOME: home,
		})
		expect(balance.code).toBe(3)
		expect(errorOf(balance)).toMatchObject({ code: "INVALID_DATE", path: "asOf" })
		const pnl = await capture(
			["report", "pnl", "--since", "2568-01-01", "--until", "2569-12-31", "--json"],
			{ TRAJ_HOME: home },
		)
		expect(pnl.code).toBe(3)
		expect(errorOf(pnl)).toMatchObject({ code: "INVALID_DATE", path: "since" })
		const until = await capture(["report", "pnl", "--until", "2569-12-31", "--json"], {
			TRAJ_HOME: home,
		})
		expect(until.code).toBe(3)
		expect(errorOf(until)).toMatchObject({ code: "INVALID_DATE", path: "until" })
	})

	it("refuses tx list's period bounds, which the filter reads itself", async () => {
		const home = fixtureHome()
		const res = await capture(["tx", "list", "--since", "2568-01-01", "--json"], {
			TRAJ_HOME: home,
		})
		expect(res.code).toBe(3)
		expect(errorOf(res)).toMatchObject({ code: "INVALID_DATE", path: "since" })
	})
})
