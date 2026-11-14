import type { ColumnHint, RenderHint } from "../table"

/** Money reads right-aligned; a date reads left. */
const money = (key: string, label: string): ColumnHint => ({ key, label, align: "right" })

/**
 * `projection run`'s human view: the annual roll-up, the monthly rows when asked, and the notes
 * under them. Only the human Format reads it; `--json` keeps the output schema as the contract.
 * A row without a value (the `levy` of a Scenario with no Levy) reads as an empty cell. The
 * annual roll-up's nested `realNetWorth` stays in JSON: a table cell cannot show its date, and
 * the monthly rows carry the real figures when `--monthly` asks for them.
 */
export const projectionHint: RenderHint = {
	tables: "tables",
	rows: "rows",
	columns: {
		annual: [
			{ key: "from", label: "from" },
			{ key: "to", label: "to" },
			money("openingNetWorth", "opening"),
			money("closingNetWorth", "closing"),
			money("income", "income"),
			money("expense", "expense"),
			money("contributions", "contributions"),
			money("unfundedContributions", "unfunded"),
			money("levy", "levy"),
			money("interest", "interest"),
			money("unmet", "unmet"),
			{ key: "partial", label: "partial" },
		],
		monthly: [
			{ key: "date", label: "date" },
			money("netWorth", "net worth"),
			money("realNetWorth", "real"),
			money("accessibleNetWorth", "accessible"),
			money("realAccessibleNetWorth", "real accessible"),
		],
	},
	note: "notes",
}
