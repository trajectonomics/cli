import type { MonthDay } from "@trajectonomics/sim"
import { checkedDate } from "../date"
import { type AppError, fail, isAppError } from "../errors"
import { parseMinorUnits } from "../store"
import type { CarryInRecordForm } from "./carryin"
import type { StatedTally } from "./carryin-classes"

/** A `periodStart` the Levy's own period can start on, or the refusal that says why not. */
export function alignedStart(input: {
	value: string
	period: MonthDay | undefined
	path: string
	levy: string
}): string | AppError {
	const checked = checkedDate(input.value, input.path)
	if (isAppError(checked)) return checked
	if (input.period === undefined) return input.value
	const month = String(input.period.month).padStart(2, "0")
	const day = String(input.period.day).padStart(2, "0")
	if (input.value.slice(5) === `${month}-${day}`) return input.value
	return fail("invalid_input", {
		path: input.path,
		message: `The Levy "${input.levy}" starts its periods on ${month}-${day}, so a record cannot start ${input.value}.`,
		hint: `State the period's first day, whose month and day are always ${month}-${day}.`,
	})
}

/** The decimal amounts of one `--carry-in` record, parsed at the currency's own scale. */
export function amountsOf(
	record: CarryInRecordForm,
	base: string,
	currency: string,
): { prepaid: number; rest: boolean; stated: StatedTally[] } | AppError {
	const stated: StatedTally[] = []
	for (const [at, tally] of record.tallies.entries()) {
		const amount = parseMinorUnits(tally.amount, currency, `${base}.tallies.${at}.amount`)
		if (isAppError(amount)) return amount
		stated.push({ label: tally.label, basis: tally.basis, amount })
	}
	const prepaid = parseMinorUnits(record.prepaid, currency, `${base}.prepaid`)
	if (isAppError(prepaid)) return prepaid
	if (record.rest === undefined) return { prepaid, rest: false, stated }
	const rest = parseMinorUnits(record.rest, currency, `${base}.rest`)
	if (isAppError(rest)) return rest
	if (rest !== 0) {
		return fail("invalid_input", {
			path: `${base}.rest`,
			message: `rest asserts every class the record does not name tallied zero, so it must be "0.00", not "${record.rest}".`,
			hint: 'State each class that was not zero in "tallies", and "rest": "0.00" for the others.',
		})
	}
	return { prepaid, rest: true, stated }
}
