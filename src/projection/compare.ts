import { project } from "@trajectonomics/sim"
import type { AppError } from "../errors"
import { fail, isAppError } from "../errors"
import { deltasOf, type SideData, sideView } from "./compare-figures"
import type { CompareView } from "./compare-view"
import { birthdayAt, rowAt } from "./dates"
import { NO_TAX, TAX } from "./echo"
import { refusal, SIM_PACKAGE, SIM_VERSION } from "./engine"
import { fiAnswerOf } from "./fi"
import { moneyOf } from "./money"
import type { Prepared } from "./prepare"

/** The two sides of a compare: `A`, or the base of a what-if, and `B`, or the what-if. */
export type CompareInput = {
	a: Prepared
	b: Prepared
	/** The birth date the ages count from, checked by the caller; null without `--age`. */
	birthDate: string | null
	/** The ages asked for with `--age`, in command-line order. */
	ages: readonly number[]
}

/** One `--age` and the birthday it reads, resolved before either side is projected. */
type Birthday = { age: number; birthday: string }

function dataOf(prepared: Prepared, birthdays: readonly Birthday[]): SideData | AppError {
	const fi = fiAnswerOf(prepared)
	if (isAppError(fi)) return fi
	const result = project(prepared.baseline, prepared.document, prepared.timeline)
	if (!result.ok) return refusal(result.problems)
	const { rows, runsOut } = result.projection
	const final = rows.at(-1)
	if (final === undefined) {
		return fail("internal", { message: "The engine reported a Projection with no rows." })
	}
	return {
		prepared,
		fi,
		runsOut,
		final,
		atAges: birthdays.map(({ age, birthday }) => ({
			age,
			row: rowAt(rows, birthday, runsOut),
		})),
	}
}

/**
 * `traj projection compare`: both Projections shown, then the deltas second minus first. A figure
 * that cannot be stated is null rather than a guess (ADR-0030).
 */
export function compareOf(input: CompareInput): CompareView | AppError {
	const { a, b, birthDate } = input
	// The leaf refuses --age without --birth-date, so this pairing is always one it allowed.
	const birthdays =
		birthDate === null
			? []
			: input.ages.map((age) => ({ age, birthday: birthdayAt(birthDate, age) }))
	const dataA = dataOf(a, birthdays)
	if (isAppError(dataA)) return dataA
	const dataB = dataOf(b, birthdays)
	if (isAppError(dataB)) return dataB
	const money = moneyOf(a.currency)
	return {
		asOf: a.timeline.start,
		horizon: a.timeline.horizon,
		currency: a.currency,
		engine: { package: SIM_PACKAGE, version: SIM_VERSION },
		birthDate: input.birthDate,
		sides: { a: sideView(dataA, money), b: sideView(dataB, money) },
		deltas: deltasOf(dataA, dataB, money),
		tax: TAX,
		notes: [NO_TAX],
	}
}
