import type { ColumnHint, RenderHint } from "../table"

/** One column of a table-shaped result, headed exactly as its row key is spelled. */
const column = (key: string, align?: ColumnHint["align"]): ColumnHint =>
	align === undefined ? { key, label: key } : { key, label: key, align }

/**
 * `projection run`'s human view: the annual roll-up, the monthly rows when asked, and the notes
 * under them. Only the human Format reads it; `--json` keeps the output schema as the contract.
 *
 * Every field of a row is a column, headed by its own key, so the table neither drops nor renames
 * a value (ADR-0027). The nested `realNetWorth` reads as its compact JSON.
 */
export const projectionHint: RenderHint = {
	tables: "tables",
	rows: "rows",
	columns: {
		annual: [
			column("index", "right"),
			column("from"),
			column("to"),
			column("openingNetWorth", "right"),
			column("closingNetWorth", "right"),
			column("income", "right"),
			column("expense", "right"),
			column("contributions", "right"),
			column("unfundedContributions", "right"),
			column("interest", "right"),
			column("unmet", "right"),
			column("partial"),
			column("realNetWorth"),
		],
		monthly: [
			column("date"),
			column("netWorth", "right"),
			column("realNetWorth", "right"),
			column("accessibleNetWorth", "right"),
			column("realAccessibleNetWorth", "right"),
		],
	},
	note: "notes",
}
