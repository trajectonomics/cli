import type { AnnualRollup, ProjectionRow, RunsOut } from "@trajectonomics/sim"
import { formatMinorUnits } from "../store"
import type { AnnualRow, MonthlyRow } from "./run-view"
import type { RunsOutView } from "./view"

/** `2026-03-30` → `2026-03-31`, in UTC, so the result never depends on the host's zone. */
export function addDays(date: string, days: number): string {
	const [year, month, day] = date.split("-").map(Number)
	if (year === undefined || month === undefined || day === undefined) {
		throw new Error(`"${date}" is not a YYYY-MM-DD date`)
	}
	return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

/** The engine's run-out in the CLI's money (ADR-0009). */
export function runsOutView(runsOut: RunsOut | undefined, currency: string): RunsOutView | null {
	if (runsOut === undefined) return null
	return { date: runsOut.date, unmet: formatMinorUnits(runsOut.unmet, currency) }
}

/**
 * The real figure at an annual roll-up's end. The engine's roll-up is nominal only and its last
 * day is the day before the anniversary, which has no monthly row, so this takes the row dated
 * that day, or the next day's row, and never presents it as `closingNetWorth` (ADR-0030).
 */
export function realNetWorthOf(
	rollup: AnnualRollup,
	rows: readonly ProjectionRow[],
	currency: string,
): AnnualRow["realNetWorth"] {
	const onDay = rows.find((row) => row.date === rollup.to)
	const found = onDay ?? rows.find((row) => row.date === addDays(rollup.to, 1))
	if (found === undefined) return null
	return { date: found.date, amount: formatMinorUnits(found.realNetWorth, currency) }
}

/** One roll-up row, money at the currency's own scale, real figure from the engine's own row. */
export function annualRow(
	rollup: AnnualRollup,
	rows: readonly ProjectionRow[],
	currency: string,
): AnnualRow {
	const money = (minor: number) => formatMinorUnits(minor, currency)
	const row: AnnualRow = {
		index: rollup.index,
		from: rollup.from,
		to: rollup.to,
		openingNetWorth: money(rollup.openingNetWorth),
		closingNetWorth: money(rollup.closingNetWorth),
		income: money(rollup.income),
		expense: money(rollup.expense),
		contributions: money(rollup.contributions),
		unfundedContributions: money(rollup.unfundedContributions),
		interest: money(rollup.interest),
		unmet: money(rollup.unmet),
		partial: rollup.partial,
		realNetWorth: realNetWorthOf(rollup, rows, currency),
	}
	if (rollup.levy !== undefined) row.levy = money(rollup.levy)
	return row
}

/** One monthly row: net worth and accessible net worth, nominal and real. */
export function monthlyRow(row: ProjectionRow, currency: string): MonthlyRow {
	const money = (minor: number) => formatMinorUnits(minor, currency)
	return {
		date: row.date,
		netWorth: money(row.netWorth),
		realNetWorth: money(row.realNetWorth),
		accessibleNetWorth: money(row.accessibleNetWorth),
		realAccessibleNetWorth: money(row.realAccessibleNetWorth),
	}
}
