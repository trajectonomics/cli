/**
 * The one worked example `traj schema scenario apply` publishes: a salary, rent, a monthly
 * investment, a debt payment and a locked retirement Account, so every unit and every kind appears
 * in a document a person can edit into their own. It carries no Levy, because `traj scenario tax`
 * writes one (ADR-0032), and `lockedUntil` names the retirement Account's lock. `schemaVersion` is
 * stamped by the caller for the same reason the template's is (ADR-0024): the pin's number is
 * asked of the core, never written down here.
 */
const EXAMPLE_BODY = {
	currency: "THB",
	economy: { inflation: 300 },
	accounts: [
		{ id: "cash", kind: "asset", rate: 150 },
		{ id: "index", kind: "asset", rate: 600, compounding: "annual" },
		{ id: "pension", kind: "asset", rate: 400, lockedUntil: "2051-01-01" },
		{ id: "loan", kind: "liability", rate: 500 },
	],
	flows: [
		{
			id: "salary",
			kind: "income",
			earned: true,
			amount: 100_000,
			frequency: "monthly",
			start: "2026-01-01",
			growth: "inflation",
		},
		{
			id: "rent",
			kind: "expense",
			amount: 20_000,
			frequency: "monthly",
			start: "2026-01-01",
			growth: { bps: 200 },
		},
		{
			id: "invest",
			kind: "contribution",
			target: "index",
			amount: 10_000,
			frequency: "monthly",
			start: "2026-01-01",
			growth: "inflation",
		},
		{
			id: "pay",
			kind: "contribution",
			target: "loan",
			amount: 5_000,
			frequency: "monthly",
			start: "2026-01-01",
			growth: "inflation",
		},
	],
	cashflow: { surplus: [{ account: "cash" }], contribute: ["index"], withdraw: ["cash"] },
}

/** The example document, stamped with the version the pinned core accepts. */
export function scenarioExample(version: number): Record<string, unknown> {
	return { schemaVersion: version, ...EXAMPLE_BODY }
}
