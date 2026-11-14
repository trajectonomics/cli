import type { Scenario } from "@trajectonomics/sim"
import { SIM_SCENARIO, SIM_TIMELINE } from "../baseline/fixture"
import { fixtureHome } from "../ledger-fixture"
import { applyScenario } from "../scenario-test-support"
import { type Captured, capture } from "../test-support"

/** The fixture Ledger's As-of, which every projection test states. */
export const AS_OF: string = SIM_TIMELINE.start

/** One year from the As-of, so the roll-up is full and the monthly rows are a whole year. */
export const HORIZON: string = SIM_TIMELINE.horizon

/**
 * The Scenario the Baseline contract golden also projects: the same engine document, stored as a
 * named Scenario. Its assets cover a year of expenses, so FI is already reachable at the As-of.
 */
export const PROJECTION_SCENARIO: Scenario = SIM_SCENARIO

/** A plan whose expenses outrun its assets: FI is out of reach, with a binding and a best case. */
export const UNREACHABLE_SCENARIO: Scenario = {
	...SIM_SCENARIO,
	flows: SIM_SCENARIO.flows.map((flow) =>
		flow.id === "rent" ? { ...flow, amount: 90_000_000 } : flow,
	),
}

/** The base, the unreachable plan and a currency v1 cannot project, all over the fixture Ledger. */
export async function projectionHome(): Promise<string> {
	const home = seededHome()
	for (const [name, scenario] of [
		["base", PROJECTION_SCENARIO],
		["unreachable", UNREACHABLE_SCENARIO],
		["usd", { ...PROJECTION_SCENARIO, currency: "USD" }],
	] as const) {
		const applied = await applyScenario(home, name, scenario)
		if (applied.code !== 0) throw new Error(applied.err)
	}
	return home
}

/** The fixture Ledger in a fresh data directory, with no Scenario stored yet. */
export function seededHome(): string {
	return fixtureHome()
}

/** Runs `traj projection ...` in JSON against one data directory. */
export function projection(home: string, argv: readonly string[]): Promise<Captured> {
	return capture(["projection", ...argv, "--json"], { TRAJ_HOME: home })
}

/** Runs `traj fi ...` in JSON against one data directory. */
export function fi(home: string, argv: readonly string[]): Promise<Captured> {
	return capture(["fi", ...argv, "--json"], { TRAJ_HOME: home })
}

/** The flags `projection run` and `fi` need: one Scenario and the two dates. */
export function baseFlags(scenario = "base"): string[] {
	return ["--scenario", scenario, ...dateFlags()]
}

/** The two dates `projection compare` needs; its Scenarios are positional. */
export function dateFlags(): string[] {
	return ["--as-of", AS_OF, "--horizon", HORIZON]
}

/** The parsed success result. */
export function resultOf(res: Captured): Record<string, unknown> {
	return JSON.parse(res.out) as Record<string, unknown>
}

/** The error envelope's `error` object. */
export type ErrorBody = {
	code: string
	exitCode: number
	message: string
	path?: string
	hint?: string
	details?: unknown
}

/** The parsed error envelope's `error` object. */
export function errorOf(res: Captured): ErrorBody {
	return (JSON.parse(res.err) as { error: ErrorBody }).error
}
