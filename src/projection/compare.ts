import { project, type Scenario } from "@trajectonomics/sim"
import type { AppError } from "../errors"
import { fail, isAppError } from "../errors"
import { birthdayAt, rowAt } from "./compare-dates"
import { deltasOf, moneyOf, type SideData, sideView } from "./compare-figures"
import type { CompareView } from "./compare-view"
import { NO_TAX, TAX } from "./echo"
import { refusal, SIM_PACKAGE, SIM_VERSION } from "./engine"
import { fiAnswerOf } from "./fi"
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

function dataOf(
	prepared: Prepared,
	ages: readonly number[],
	birthDate: string | null,
): SideData | AppError {
	const fi = fiAnswerOf(prepared)
	if (isAppError(fi)) return fi
	// The CLI never models a Scenario (ADR-0024): the stored document is the engine's own, and the
	// engine validates it again on the way in.
	const result = project(
		prepared.baseline,
		prepared.document as unknown as Scenario,
		prepared.timeline,
	)
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
		// The leaf refuses --age without --birth-date, so a null here with ages is a bug.
		atAges: ages.map((age) => ({
			age,
			row: rowAt(rows, birthdayAt(birthDate ?? "", age), runsOut),
		})),
	}
}

/**
 * `traj projection compare`: both Projections shown, then the deltas second minus first. A figure
 * that cannot be stated is null rather than a guess (ADR-0030).
 */
export function compareOf(input: CompareInput): CompareView | AppError {
	const { a, b } = input
	const dataA = dataOf(a, input.ages, input.birthDate)
	if (isAppError(dataA)) return dataA
	const dataB = dataOf(b, input.ages, input.birthDate)
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
