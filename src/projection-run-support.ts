import type { Captured } from "./test-support"

/** The `projection run` result as a test reads it, and the helpers that reach into it. */
/** One annual roll-up row as a test reads it. */
export type AnnualRowBody = {
	index: number
	from: string
	to: string
	openingNetWorth: string
	closingNetWorth: string
	income: string
	expense: string
	contributions: string
	unfundedContributions: string
	interest: string
	unmet: string
	partial: boolean
	realNetWorth: { date: string; amount: string } | null
}

/** One monthly row as a test reads it. */
export type MonthlyRowBody = {
	date: string
	netWorth: string
	realNetWorth: string
	accessibleNetWorth: string
	realAccessibleNetWorth: string
}

/** A row of either table: the two shapes share only `date` and `realNetWorth`. */
export type RowBody = Omit<Partial<AnnualRowBody>, "realNetWorth"> &
	Omit<Partial<MonthlyRowBody>, "realNetWorth"> & {
		realNetWorth?: { date: string; amount: string } | string | null | undefined
	}

/** One table of a `projection run` result. */
export type TableBody = {
	name: string
	count: number
	rows: RowBody[]
}

/** The `projection run` result, as much of it as these tests read. */
export type RunBody = {
	asOf: string
	horizon: string
	currency: string
	engine: { package: string; version: string }
	scenario: { id: string; name: string; contentHash: string; effectiveContentHash: string }
	overrides: { path: string; value: unknown }[]
	tax: string
	notes: string[]
	runsOut: { date: string; unmet: string } | null
	tables: TableBody[]
}

/** A `projection run` or `fi` result parsed from its JSON. */
export function runBody(res: Captured): RunBody {
	return JSON.parse(res.out) as RunBody
}

/** One table of a result, by name; fails the test with a useful message when it is absent. */
export function tableOf(body: RunBody, name: string): TableBody {
	const table = body.tables.find((entry) => entry.name === name)
	if (table === undefined) throw new Error(`the result has no ${name} table`)
	return table
}
