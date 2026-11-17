import { type AppError, fail, isAppError } from "../errors"
import type { ScenarioDocument } from "../scenario/document"
import { leviesOf } from "../scenario/tax"
import type { JsonRecord } from "../scenario/tax/json"
import { CARRY_IN_FIELD, type CarryInRecordForm } from "./carryin"
import { echoOf, replaced } from "./carryin-echo"
import { entriesOf } from "./carryin-levy"
import { completed } from "./carryin-needed"
import type { CarryInEcho } from "./carryin-view"
import { taxNotes } from "./levies"
import { carryInStarts, periodStartAtOrBefore, storedMonthDay } from "./periods"

/** A Projection's input: the effective Scenario, the dates, and the records the flag stated. */
export type PlaceInput = {
	document: ScenarioDocument
	scenario: { id: string; name: string; path: string }
	asOf: string
	currency: string
	records: readonly CarryInRecordForm[]
}

/** What placing one side's Carry-in settled: the document the engine gets, its echo and notes. */
export type PlacedCarryIn = {
	document: ScenarioDocument
	carryIn: CarryInEcho[]
	notes: string[]
}

/** The period starts a Levy needs a record for, or null when nothing here can be derived. */
function neededOf(levy: JsonRecord, asOf: string): { starts: string[]; current: string } | null {
	const period = storedMonthDay(levy["period"])
	const settlement = storedMonthDay(levy["settlement"])
	if (period === undefined || settlement === undefined) return null
	return {
		starts: carryInStarts(asOf, { period, settlement }),
		current: periodStartAtOrBefore(asOf, period),
	}
}

/** The refusal for a `--carry-in` whose Scenario holds no Levy to state anything about. */
function noLevy(scenario: string): AppError {
	return fail("invalid_input", {
		path: CARRY_IN_FIELD,
		message: `The Scenario "${scenario}" holds no Levy, so there is no Carry-in to state.`,
		hint: 'Remove --carry-in, or write a Levy into the Scenario with "traj scenario tax".',
	})
}

/** The refusal for a record that names a Levy the Scenario does not hold. */
function unknownLevy(levy: string, index: number): AppError {
	return fail("invalid_input", {
		path: `document.${index}.levy`,
		message: `The Scenario holds no Levy "${levy}", so the record cannot be placed.`,
		hint: "Name a Levy by the id the Scenario spells it with.",
	})
}

/** One Levy with its records placed in period order, or the refusal that stopped the placement. */
function placementOf(
	levy: JsonRecord,
	input: PlaceInput,
	selected: readonly { record: CarryInRecordForm; index: number }[],
): { levy: JsonRecord; carryIn: CarryInEcho[] } | AppError {
	const id = typeof levy["id"] === "string" ? levy["id"] : ""
	const mine = selected.filter((it) => it.record.levy === id)
	const loaded = entriesOf(levy, id, mine, input)
	if (isAppError(loaded)) return loaded
	const items = completed({
		items: loaded.items,
		classes: loaded.classes,
		id,
		needed: Object.hasOwn(input.document, "calendar") ? null : neededOf(levy, input.asOf),
	})
	if (isAppError(items)) return items
	const ordered = [...items].sort((a, b) => a.entry.periodStart.localeCompare(b.entry.periodStart))
	return {
		levy: replaced(levy, ordered),
		carryIn: ordered.map((it) => echoOf(it.entry, id, input.currency)),
	}
}

/**
 * Places the caller's Carry-in in every Levy of the effective Scenario (ADR-0032). The flag's
 * records are matched by Scenario and Levy, checked class by class, and completed with the scope
 * record only where this build wrote the Levy; the rest is the caller's or a refusal.
 */
export function placeCarryIn(input: PlaceInput): PlacedCarryIn | AppError {
	const levies = leviesOf(input.document)
	const selected = input.records
		.map((record, index) => ({ record, index }))
		.filter(
			(it) =>
				it.record.scenario === input.scenario.id || it.record.scenario === input.scenario.name,
		)
	if (selected.length > 0 && levies.length === 0) return noLevy(input.scenario.name)
	const unknown = selected.find((it) => !levies.some((levy) => levy["id"] === it.record.levy))
	if (unknown !== undefined) return unknownLevy(unknown.record.levy, unknown.index)
	const placements: JsonRecord[] = []
	const carryIn: CarryInEcho[] = []
	for (const levy of levies) {
		const placement = placementOf(levy, input, selected)
		if (isAppError(placement)) return placement
		placements.push(placement.levy)
		carryIn.push(...placement.carryIn)
	}
	// An empty `levies` array is not the same document as no key: the engine refuses the first.
	const document: ScenarioDocument =
		levies.length === 0 ? input.document : { ...input.document, levies: placements }
	return { document, carryIn, notes: taxNotes(document, input.asOf, carryIn) }
}
