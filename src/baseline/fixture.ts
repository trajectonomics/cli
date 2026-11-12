import type { Scenario, Timeline } from "@trajectonomics/sim"
import { FIXTURE_ACCOUNTS, FIXTURE_AS_OF } from "../ledger-fixture"

/*
 * The Scenario and Timeline the contract golden projects under. They are a real engine document,
 * not a stub: rates, a lock, an income and an expense flow and a contribution, so the Projection
 * exercises interest, the accessible-net-worth split and the annual rollup. The Scenario is
 * written here, never derived from the mapping, so a wrong kind fails its own assertion instead
 * of quietly reshaping the Projection.
 *
 * Cash's rate is 0 bps and no surplus step carries `upTo`, so a raised cash Balance moves every
 * row by exactly that amount with no interest to blur it (the change-control test). No window
 * runs cash short, so `unmet` stays zero and no withdrawal can mask a shift.
 */
export const SIM_SCENARIO: Scenario = {
	schemaVersion: 1,
	currency: "THB",
	economy: { inflation: 250 },
	accounts: [
		{ id: FIXTURE_ACCOUNTS.bank, kind: "asset", rate: 100 },
		{ id: FIXTURE_ACCOUNTS.cash, kind: "asset", rate: 0 },
		{ id: FIXTURE_ACCOUNTS.investment, kind: "asset", rate: 500 },
		{ id: FIXTURE_ACCOUNTS.locked, kind: "asset", rate: 300, lockedUntil: "2027-01-01" },
		{ id: FIXTURE_ACCOUNTS.oldWallet, kind: "asset", rate: 0 },
		{ id: FIXTURE_ACCOUNTS.loan, kind: "liability", rate: 600 },
	],
	flows: [
		{
			id: "salary",
			kind: "income",
			earned: true,
			amount: 8000000,
			frequency: "monthly",
			start: "2026-04-01",
			growth: "inflation",
		},
		{
			id: "rent",
			kind: "expense",
			amount: 2500000,
			frequency: "monthly",
			start: "2026-04-01",
			growth: "inflation",
		},
		{
			id: "invest",
			kind: "contribution",
			target: FIXTURE_ACCOUNTS.investment,
			amount: 1000000,
			frequency: "monthly",
			start: "2026-04-01",
			growth: { bps: 0 },
		},
	],
	cashflow: { surplus: [{ account: FIXTURE_ACCOUNTS.cash }], withdraw: [FIXTURE_ACCOUNTS.cash] },
}

/** One year stated from the fixture's As-of, so the first row is dated it and the rollup is full. */
export const SIM_TIMELINE: Timeline = {
	start: FIXTURE_AS_OF,
	horizon: "2027-03-30",
	resolution: "month",
}
