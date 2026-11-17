import { type AppError, fail } from "../errors"
import { TAX_LEVY_ID } from "../scenario/tax"
import { CARRY_IN_FIELD } from "./carryin"
import type { CarryInClass } from "./carryin-classes"
import type { Needed, Working } from "./carryin-levy"

/** The refusal for the current period's record, which only the caller can state. */
function needsRecord(
	levy: string,
	periodStart: string,
	classes: readonly CarryInClass[],
): AppError {
	return fail("invalid_input", {
		path: CARRY_IN_FIELD,
		message: `The Levy "${levy}" needs a Carry-in record for the period that started ${periodStart}, which this Projection starts inside of.`,
		hint: 'State what that period tallied and prepaid before the As-of with --carry-in, and "0.00" for a class it had no income in.',
		details: { levy, periodStart, missing: classes },
	})
}

/** The refusal for a past period only the caller can state, because the CLI did not write the Levy. */
function needsOwnRecord(levy: string, periodStart: string): AppError {
	return fail("invalid_input", {
		path: CARRY_IN_FIELD,
		message: `The Levy "${levy}" needs its Carry-in record for ${periodStart}, and this build does not know what a Levy it did not write settled.`,
		hint: "State that period's record with --carry-in rather than letting the CLI assume it was empty.",
	})
}

/** The refusal for a stated period this Projection does not need. */
function unrequested(ledgerPeriod: string, levy: string, index: number): AppError {
	return fail("invalid_input", {
		path: `document.${index}.periodStart`,
		message: `The record states the period ${ledgerPeriod} for the Levy "${levy}", which this Projection does not need.`,
		hint: "State only the periods the As-of leaves open: the one it starts inside, and the one before when its Settlement still falls inside.",
	})
}

/**
 * Fills in what the As-of implies and refuses what it cannot: the period containing the As-of is
 * the caller's, class by class, and a period that ended before it is the caller's too unless it is
 * this build's own `th-2026-pit`, whose scope record is the empty one the CLI can vouch for.
 * A Scenario that declares its own calendar gets no derivation at all: its records are placed as
 * given, because only the engine can say which periods its calendar leaves open.
 */
export function completed(input: {
	items: readonly Working[]
	classes: readonly CarryInClass[]
	id: string
	needed: Needed | null
}): Working[] | AppError {
	if (input.needed === null) return [...input.items]
	const { starts, current } = input.needed
	const present = new Set(input.items.map((it) => it.entry.periodStart))
	const next = [...input.items]
	for (const start of starts) {
		if (present.has(start)) continue
		if (start === current) return needsRecord(input.id, start, input.classes)
		if (input.id !== TAX_LEVY_ID) return needsOwnRecord(input.id, start)
		next.push({
			entry: { periodStart: start, tallies: [], prepaid: 0, source: "scope" },
			flag: null,
		})
	}
	const stated = next.find((it) => it.flag !== null && !starts.includes(it.entry.periodStart))
	if (stated?.flag == null) return next
	return unrequested(stated.entry.periodStart, input.id, stated.flag)
}
