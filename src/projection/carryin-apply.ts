import type { Scenario } from "@trajectonomics/sim"
import { type AppError, fail, isAppError } from "../errors"
import type { CarryInRecordForm } from "./carryin"
import { placeCarryIn } from "./carryin-place"
import type { CarryInEcho } from "./carryin-view"
import type { Prepared } from "./prepare"

/** One prepared side with the caller's Carry-in placed in it, and what a person must read. */
export type Placed = Prepared & {
	document: Scenario
	carryIn: CarryInEcho[]
	notes: string[]
}

/** The refusal for a record that names a Scenario this command does not prepare. */
function unknownScenario(record: CarryInRecordForm, index: number): AppError {
	return fail("invalid_input", {
		path: `document.${index}.scenario`,
		message: `The record names the Scenario "${record.scenario}", which this Projection does not prepare.`,
		hint: "Name a Scenario the command prepares, by its exact name or its id.",
	})
}

/**
 * The Carry-in of a command that prepares exactly one Scenario, so `run` and `fi` share one flow.
 */
export function withCarryInSide(input: {
	prepared: Prepared
	records: readonly CarryInRecordForm[]
	asOf: string
}): Placed | AppError {
	const placed = withCarryIn({
		sides: [input.prepared],
		records: input.records,
		asOf: input.asOf,
		currency: input.prepared.currency,
	})
	if (isAppError(placed)) return placed
	const [side] = placed
	if (side === undefined)
		return fail("internal", { message: "A one-sided command placed no side." })
	return side
}

/**
 * Places the caller's Carry-in into every prepared side (ADR-0032). It runs once per command,
 * after both sides are prepared, because only the pair knows which Scenario names are valid: a
 * record that names neither side is refused before any side says it is missing one.
 */
export function withCarryIn(input: {
	sides: readonly Prepared[]
	records: readonly CarryInRecordForm[]
	asOf: string
	currency: string
}): Placed[] | AppError {
	const named = new Set(input.sides.flatMap((side) => [side.scenario.id, side.scenario.name]))
	const unused = input.records.findIndex((record) => !named.has(record.scenario))
	const stray = input.records[unused]
	if (stray !== undefined) return unknownScenario(stray, unused)
	const placed: Placed[] = []
	for (const side of input.sides) {
		const outcome = placeCarryIn({
			document: side.document as unknown as Record<string, unknown>,
			scenario: { id: side.scenario.id, name: side.scenario.name, path: side.scenarioPath },
			asOf: input.asOf,
			currency: input.currency,
			records: input.records,
		})
		if (isAppError(outcome)) return outcome
		placed.push({
			...side,
			document: outcome.document as unknown as Scenario,
			carryIn: outcome.carryIn,
			notes: outcome.notes,
		})
	}
	return placed
}
