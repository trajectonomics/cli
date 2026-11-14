import type { ProjectionRow, RunsOut } from "@trajectonomics/sim"
import type { CompareSide } from "./compare-side"
import type { CompareDeltas } from "./compare-view"
import { monthsBetween, yearsBetween } from "./dates"
import type { FiSolution } from "./fi"
import type { Prepared } from "./prepare"
import { runsOutView } from "./rows"

/** One side's engine facts, kept as the engine states them so a delta is a subtraction. */
export type SideData = {
	prepared: Prepared
	fi: FiSolution
	runsOut: RunsOut | undefined
	final: ProjectionRow
	atAges: { age: number; row: ProjectionRow | undefined }[]
}

/** One side as the result states it, money at the currency's own scale. */
export function sideView(data: SideData, money: (minor: number) => string): CompareSide {
	return {
		scenario: data.prepared.scenario,
		overrides: data.prepared.overrides,
		fi: data.fi.fi,
		runOut: runsOutView(data.runsOut, data.prepared.currency),
		netWorth: {
			final: {
				date: data.final.date,
				nominal: money(data.final.netWorth),
				real: money(data.final.realNetWorth),
			},
			atAges: data.atAges.map(({ age, row }) => ({
				age,
				nominal: row === undefined ? null : money(row.netWorth),
				real: row === undefined ? null : money(row.realNetWorth),
			})),
		},
	}
}

/** Second minus first, per figure, or null where the figure has no meaning on one side. */
export function deltasOf(
	a: SideData,
	b: SideData,
	money: (minor: number) => string,
): CompareDeltas {
	const figure = (left: number | undefined, right: number | undefined): string | null =>
		left === undefined || right === undefined ? null : money(right - left)
	return {
		fiMonths:
			a.fi.fi.reachable && b.fi.fi.reachable ? monthsBetween(a.fi.fi.fiDate, b.fi.fi.fiDate) : null,
		runOutYears:
			a.runsOut === undefined || b.runsOut === undefined
				? null
				: yearsBetween(a.runsOut.date, b.runsOut.date),
		// A figure at the horizon only: two sides that run out in different months are not comparable.
		netWorth:
			a.final.date === b.final.date
				? {
						nominal: money(b.final.netWorth - a.final.netWorth),
						real: money(b.final.realNetWorth - a.final.realNetWorth),
					}
				: null,
		atAges: a.atAges.map((figureA, index) => {
			const figureB = b.atAges[index]
			return {
				age: figureA.age,
				nominal: figure(figureA.row?.netWorth, figureB?.row?.netWorth),
				real: figure(figureA.row?.realNetWorth, figureB?.row?.realNetWorth),
			}
		}),
	}
}
