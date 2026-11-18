import { project } from "@trajectonomics/sim"
import type { AppError } from "../errors"
import { fail, isAppError } from "../errors"
import type { Placed } from "./carryin-apply"
import { deltasOf, type SideData, sideView } from "./compare-figures"
import type { CompareView } from "./compare-view"
import { birthdayAt, rowAt } from "./dates"
import { refusal, SIM_PACKAGE, SIM_VERSION } from "./engine"
import { fiAnswerOf } from "./fi"
import { fundingNotes } from "./funding"
import { NO_TAX } from "./levies"
import { moneyOf } from "./money"
import { taxYearsOf } from "./tax-view"
import type { TaxStatus } from "./view"

/** The same sentence twice is one sentence: two sides can share a Levy, a period or a year. */
function both(a: readonly string[], b: readonly string[]): string[] {
	return [...new Set([...a, ...b])]
}

/**
 * The tax a compare reports: both sides taxed is `applied`, neither is `not_applied`, and one is
 * `mixed` — a Delta between a taxed and an untaxed Scenario is mostly the tax, and the note says
 * so. Both sides' notes are kept only when both are taxed, because each side then names its own
 * Levies and its own Carry-in; a mixed compare keeps the taxed side's, since the untaxed side's
 * sentence would deny the tax the deltas include.
 */
function taxOf(input: CompareInput): { tax: TaxStatus; notes: string[] } {
	const applied = input.a.tax === "applied"
	const alsoApplied = input.b.tax === "applied"
	if (applied && alsoApplied) return { tax: "applied", notes: both(input.a.notes, input.b.notes) }
	if (!applied && !alsoApplied) return { tax: "not_applied", notes: [NO_TAX] }
	return {
		tax: "mixed",
		notes: [
			`Only ${applied ? "A" : "B"} is taxed, so the Deltas between the two sides include the tax.`,
			...(applied ? input.a.notes : input.b.notes),
		],
	}
}

/** The two sides of a compare: `A`, or the base of a what-if, and `B`, or the what-if. */
export type CompareInput = {
	a: Placed
	b: Placed
	/** The birth date the ages count from, checked by the caller; null without `--age`. */
	birthDate: string | null
	/** The ages asked for with `--age`, in command-line order. */
	ages: readonly number[]
}

/** One `--age` and the birthday it reads, resolved before either side is projected. */
type Birthday = { age: number; birthday: string }

function dataOf(prepared: Placed, birthdays: readonly Birthday[]): SideData | AppError {
	const solution = fiAnswerOf(prepared)
	if (isAppError(solution)) return solution
	const result = project(prepared.baseline, prepared.document, prepared.timeline)
	if (!result.ok) return refusal(result.problems)
	const { rows, runsOut } = result.projection
	const final = rows.at(-1)
	if (final === undefined) {
		return fail("internal", { message: "The engine reported a Projection with no rows." })
	}
	return {
		prepared,
		fi: solution,
		runsOut,
		taxYears: taxYearsOf(result.projection.levies, prepared.currency),
		unfunded: result.projection.unfundedContributions,
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
	const tax = taxOf(input)
	return {
		asOf: a.timeline.start,
		horizon: a.timeline.horizon,
		currency: a.currency,
		engine: { package: SIM_PACKAGE, version: SIM_VERSION },
		birthDate: input.birthDate,
		sides: { a: sideView(dataA, money), b: sideView(dataB, money) },
		deltas: deltasOf(dataA, dataB, money),
		tax: tax.tax,
		notes: [
			...tax.notes,
			...fundingNotes(dataA.unfunded, a.currency, "A"),
			...fundingNotes(dataB.unfunded, b.currency, "B"),
		],
	}
}
