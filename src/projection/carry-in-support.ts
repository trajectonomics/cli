import { writeFileSync } from "node:fs"
import { join } from "node:path"
import type { TallyBasis } from "@trajectonomics/sim"
import { emitThLevy } from "@trajectonomics/tax/th"
import { scenario } from "../scenario-test-support"
import { projectionHome } from "./testing"

/** The Thai Levy's classes, as its own `tally` measures read them: 22 income, 7 allowances. */
export const TH_CLASSES: readonly { label: string; basis: TallyBasis }[] = emitThLevy({
	filingStatus: "single",
	allowances: { children: { totalCount: 0, secondPlusBorn2018OrLaterCount: 0 } },
	levy: { id: "th-2026-pit" },
})
	.measures.filter((measure) => measure.op === "tally")
	.map((measure) => ({ label: measure.label, basis: measure.basis as TallyBasis }))

/** The flags that put a Projection inside the Thai Levy's 2026 period. */
export const MID_PERIOD: readonly string[] = ["--as-of", "2026-06-01", "--horizon", "2027-12-31"]

/** Every class at zero, which is what `"rest": "0.00"` asserts in one line. */
export function zeroTallies(): { label: string; basis: TallyBasis; amount: string }[] {
	return TH_CLASSES.map(({ label, basis }) => ({ label, basis, amount: "0.00" }))
}

/** A Scenario of the fixture plan whose salary is Section 40(1) income with this build's Levy. */
export async function taxedHome(): Promise<string> {
	const home = await projectionHome()
	const applied = await scenario(home, [
		"tax",
		"base",
		"--tax",
		"th-2026",
		"--label",
		"salary=income.section40_1",
	])
	if (applied.code !== 0) throw new Error(applied.err)
	return home
}

/** Writes one `--carry-in` document beside the data directory and returns its path. */
export function carryInFile(home: string, records: unknown): string {
	const path = join(home, "carry-in.json")
	writeFileSync(path, JSON.stringify(records))
	return path
}

/** One record for the Thai Levy's 2026 period, with the salary class stated and the rest zero. */
export function thRecord(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		scenario: "base",
		levy: "th-2026-pit",
		periodStart: "2026-01-01",
		tallies: [
			{ label: "income.section40_1", basis: "gross", amount: "0.00" },
			{ label: "allowance.retirement.rmf", basis: "funded", amount: "0.00" },
		],
		prepaid: "0.00",
		rest: "0.00",
		...overrides,
	}
}
