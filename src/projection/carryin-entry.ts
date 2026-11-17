import type { MonthDay } from "@trajectonomics/sim"
import { type AppError, fail, isAppError } from "../errors"
import type { JsonRecord } from "../scenario/tax/json"
import { records as objects } from "../scenario/tax/json"
import type { CarryInRecordForm } from "./carryin"
import { type CarryInClass, type StatedTally, withAllClasses } from "./carryin-classes"
import { alignedStart, amountsOf } from "./carryin-record"
import { flagProblem, storedProblem } from "./carryin-refuse"
import { type CarryInSource, isBasis } from "./carryin-view"

/** The refusal for a stored record whose shape this build cannot read at all. */
function unreadable(path: string, levy: string, at: string, what: string): AppError {
	return fail("invalid_input", {
		path,
		message: `The stored Carry-in for "${levy}" from ${at} states ${what}.`,
		hint: "Re-apply the Scenario with a periodStart, tallies and a prepaid amount for every record.",
	})
}

/** One Carry-in record resolved into minor units, ready to place in a Levy and echo. */
export type CarryInEntry = {
	periodStart: string
	tallies: StatedTally[]
	prepaid: number
	source: CarryInSource
}

/** One `--carry-in` record: its period aligned, its amounts parsed, its classes complete. */
export function flagEntry(input: {
	record: CarryInRecordForm
	index: number
	levy: string
	classes: readonly CarryInClass[]
	currency: string
	period: MonthDay | undefined
}): CarryInEntry | AppError {
	const base = `document.${input.index}`
	const periodStart = alignedStart({
		value: input.record.periodStart,
		period: input.period,
		path: `${base}.periodStart`,
		levy: input.levy,
	})
	if (isAppError(periodStart)) return periodStart
	const amounts = amountsOf(input.record, base, input.currency)
	if (isAppError(amounts)) return amounts
	const tallies = withAllClasses(amounts.stated, input.classes, amounts.rest, (problem) =>
		flagProblem(problem, { base, levy: input.levy, periodStart }),
	)
	if (isAppError(tallies)) return tallies
	return { periodStart, tallies, prepaid: amounts.prepaid, source: "flag" }
}

/** One stored `levy.carryIn` record, resolved by the same class rule as the flag's. */
export function storedEntry(input: {
	record: JsonRecord
	levy: string
	classes: readonly CarryInClass[]
	path: string
	period: MonthDay | undefined
}): CarryInEntry | AppError {
	const at = input.record["periodStart"]
	if (typeof at !== "string") return unreadable(input.path, input.levy, "at", "no period start")
	const periodStart = alignedStart({
		value: at,
		period: input.period,
		path: input.path,
		levy: input.levy,
	})
	if (isAppError(periodStart)) return periodStart
	const stated: StatedTally[] = []
	for (const tally of objects(input.record["tallies"])) {
		const { label, basis, amount } = tally
		if (typeof label !== "string" || !isBasis(basis) || typeof amount !== "number") {
			return unreadable(input.path, input.levy, at, "a class this build cannot read")
		}
		stated.push({ label, basis, amount })
	}
	const prepaid = input.record["prepaid"]
	if (typeof prepaid !== "number") {
		return unreadable(input.path, input.levy, at, "no prepaid amount")
	}
	const tallies = withAllClasses(stated, input.classes, false, (problem) =>
		storedProblem(problem, { path: input.path, levy: input.levy, periodStart }),
	)
	if (isAppError(tallies)) return tallies
	return { periodStart, tallies, prepaid, source: "document" }
}
