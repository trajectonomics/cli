import { acceptedScenarioSchemaVersion } from "./document"

/**
 * The document `--template` prints: one asset account, one monthly earned Stream, the surplus
 * routed to it, and empty contribution and withdrawal lists. Every key `check()` requires is here,
 * the amounts are integers of minor units, the Stream's start is a fixed date rather than the clock,
 * and there is no Levy, because `scenario tax` is the only command that writes one (ADR-0032).
 */
const TEMPLATE_DOCUMENT = {
	currency: "THB",
	economy: { inflation: 0 },
	accounts: [{ id: "cash", kind: "asset", rate: 0 }],
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
	],
	cashflow: { surplus: [{ account: "cash" }], contribute: [], withdraw: [] },
} as const

/**
 * The template text, stamped with the version the pinned core accepts, or `undefined` when the pin
 * accepts none inside the scan's bound. `JSON.stringify` keeps the literal's key order, the text
 * carries no trailing newline of its own, and nothing here reads the clock, the environment or the
 * data directory, so one file is byte-identical on every host (ADR-0033).
 */
export function scenarioTemplate(): string | undefined {
	const version = acceptedScenarioSchemaVersion()
	if (version === undefined) return undefined
	return JSON.stringify({ schemaVersion: version, ...TEMPLATE_DOCUMENT }, null, 2)
}
