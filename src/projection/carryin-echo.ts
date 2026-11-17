import type { JsonRecord } from "../scenario/tax/json"
import { formatMinorUnits } from "../store"
import type { Working } from "./carryin-levy"
import type { CarryInEcho } from "./carryin-view"

/** One record as the result echoes it: amounts at the currency's own scale (ADR-0009). */
export function echoOf(entry: Working["entry"], levy: string, currency: string): CarryInEcho {
	return {
		levy,
		periodStart: entry.periodStart,
		tallies: entry.tallies.map((it) => ({
			label: it.label,
			basis: it.basis,
			amount: formatMinorUnits(it.amount, currency),
		})),
		prepaid: formatMinorUnits(entry.prepaid, currency),
		source: entry.source,
	}
}

/** The Levy with the records placed in the Scenario's own order, or the Levy when it has none. */
export function replaced(levy: JsonRecord, items: readonly Working[]): JsonRecord {
	if (items.length === 0) return levy
	return {
		...levy,
		carryIn: items.map(({ entry }) => ({
			periodStart: entry.periodStart,
			tallies: entry.tallies.map(({ label, basis, amount }) => ({ label, basis, amount })),
			prepaid: entry.prepaid,
		})),
	}
}
