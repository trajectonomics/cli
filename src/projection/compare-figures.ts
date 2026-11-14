import type { ProjectionRow, RunsOut } from "@trajectonomics/sim"
import { formatMinorUnits } from "../store"
import { monthsBetween, yearsBetween } from "./compare-dates"
import type { CompareDeltas, CompareSide } from "./compare-view"
import type { FiAnswer } from "./fi-view"
import type { Prepared } from "./prepare"

/** One side's engine facts, kept as the engine states them so a delta is a subtraction. */
export type SideData = {
	prepared: Prepared
	fi: FiAnswer
	runsOut: RunsOut | undefined
	final: ProjectionRow
	atAges: { age: number; row: ProjectionRow | undefined }[]
}

/** One side as the result states it, money at the currency's own scale. */
export function sideView(data: SideData, money: (minor: number) => string): CompareSide {
	return {
		scenario: data.prepared.scenario,
		overrides: data.prepared.overrides,
		fi: data.fi,
		runOut:
			data.runsOut === undefined
				? null
				: { date: data.runsOut.date, unmet: money(data.runsOut.unmet) },
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
		fiMonths: a.fi.reachable && b.fi.reachable ? monthsBetween(a.fi.fiDate, b.fi.fiDate) : null,
		runOutYears:
			a.runsOut === undefined || b.runsOut === undefined
				? null
				: yearsBetween(a.runsOut.date, b.runsOut.date),
		netWorth: {
			nominal: money(b.final.netWorth - a.final.netWorth),
			real: money(b.final.realNetWorth - a.final.realNetWorth),
		},
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

/** The currency's money formatter, so every figure of one result renders the same way. */
export function moneyOf(currency: string): (minor: number) => string {
	return (minor: number) => formatMinorUnits(minor, currency)
}
