import { describe, expect, it } from "bun:test"
import { check, project } from "@trajectonomics/sim"
import simPackage from "@trajectonomics/sim/package.json"
import { SIM_SCENARIO, SIM_TIMELINE } from "./baseline/fixture"
import {
	baselineFrom,
	cli,
	goldenJson,
	goldenText,
	recordGolden,
	type Shown,
	show,
} from "./baseline/testing"
import { FIXTURE_ACCOUNTS, FIXTURE_AS_OF, fixtureHome } from "./ledger-fixture"
import { parseMinorUnits } from "./store"

/** The hand-computed Baseline the fixture Ledger states at the As-of (see its arithmetic). */
const HAND_COMPUTED: Shown = {
	asOf: FIXTURE_AS_OF,
	currency: "THB",
	rows: [
		{ account: { id: FIXTURE_ACCOUNTS.bank, name: "Bank" }, kind: "asset", amount: "528549.50" },
		{ account: { id: FIXTURE_ACCOUNTS.cash, name: "Cash" }, kind: "asset", amount: "499900.01" },
		{
			account: { id: FIXTURE_ACCOUNTS.investment, name: "Investment" },
			kind: "asset",
			amount: "100000.00",
		},
		{
			account: { id: FIXTURE_ACCOUNTS.loan, name: "Loan" },
			kind: "liability",
			amount: "200000.00",
		},
		{ account: { id: FIXTURE_ACCOUNTS.locked, name: "Locked" }, kind: "asset", amount: "20000.00" },
		{
			account: { id: FIXTURE_ACCOUNTS.oldWallet, name: "Old wallet" },
			kind: "asset",
			amount: "5000.00",
		},
	],
}

/** The Ledger's net worth at the As-of, from the net-worth report's own total: THB, or nothing. */
async function ledgerNetWorth(home: string): Promise<number> {
	const res = await cli(home)(["report", "networth", "--as-of", FIXTURE_AS_OF, "--json"])
	expect(res.code).toBe(0)
	const { totals } = JSON.parse(res.out) as { totals: { currency: string; amount: string }[] }
	const thb = totals.find((total) => total.currency === "THB")
	if (thb === undefined) return 0
	const parsed = parseMinorUnits(thb.amount, "THB", "netWorth")
	if (typeof parsed !== "number") throw new Error(`"${thb.amount}" is not a money amount`)
	return parsed
}

describe("the Baseline contract golden", () => {
	it("matches the Baseline the fixture Ledger states, deep equal", async () => {
		const res = await show(fixtureHome())
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toEqual(HAND_COMPUTED)
	})

	it("produces a Baseline the engine's own validator accepts", async () => {
		const data = JSON.parse((await show(fixtureHome())).out) as Shown
		const baseline = baselineFrom(data)
		expect(check(baseline, SIM_SCENARIO, SIM_TIMELINE)).toEqual([])
	})

	it("declares every Baseline Account with the kind the CLI reported", async () => {
		const data = JSON.parse((await show(fixtureHome())).out) as Shown
		expect(SIM_SCENARIO.currency).toBe(data.currency)
		for (const row of data.rows) {
			const declared = SIM_SCENARIO.accounts.find((account) => account.id === row.account.id)
			expect(declared?.kind).toBe(row.kind)
		}
		expect(
			SIM_SCENARIO.accounts.find((account) => account.id === FIXTURE_ACCOUNTS.locked),
		).toMatchObject({
			lockedUntil: "2027-01-01",
		})
	})

	it("keeps unmet zero, so no withdrawal or cap can mask a shift", async () => {
		const data = JSON.parse((await show(fixtureHome())).out) as Shown
		const result = project(baselineFrom(data), SIM_SCENARIO, SIM_TIMELINE)
		if (!result.ok) throw new Error(JSON.stringify(result.problems))
		expect(result.projection.annual.every((year) => year.unmet === 0)).toBe(true)
		expect(SIM_SCENARIO.cashflow.surplus.every((step) => step.upTo === undefined)).toBe(true)
	})

	it("projects the fixture into the committed golden, byte for byte", async () => {
		const data = JSON.parse((await show(fixtureHome())).out) as Shown
		const result = project(baselineFrom(data), SIM_SCENARIO, SIM_TIMELINE)
		expect(result.ok).toBe(true)
		if (!result.ok) return
		const { projection } = result
		expect(projection.runsOut).toBeUndefined()
		expect(projection.rows[0]?.date).toBe(SIM_TIMELINE.start)
		expect(SIM_TIMELINE.start).toBe(FIXTURE_AS_OF)
		const golden = {
			simVersion: simPackage.version,
			rows: projection.rows,
			annual: projection.annual,
		}
		await recordGolden("projection.json", golden)
		expect(goldenJson(golden)).toBe(await goldenText("projection.json"))
	})

	it("opens the projection at the Ledger's own net worth, not at the first row", async () => {
		const home = fixtureHome()
		const data = JSON.parse((await show(home)).out) as Shown
		const result = project(baselineFrom(data), SIM_SCENARIO, SIM_TIMELINE)
		if (!result.ok) throw new Error(JSON.stringify(result.problems))
		const opening = result.projection.annual[0]?.openingNetWorth
		expect(opening).toBe(await ledgerNetWorth(home))
	})

	it("records the engine version the golden was produced with", async () => {
		const golden = JSON.parse(await goldenText("projection.json")) as { simVersion: string }
		if (golden.simVersion !== simPackage.version) {
			throw new Error(
				`The golden was produced with @trajectonomics/sim ${golden.simVersion}, but ${simPackage.version} is installed. Re-baseline it deliberately: TRAJ_UPDATE_GOLDEN=1 bun test src/baseline-golden.test.ts`,
			)
		}
	})
})
