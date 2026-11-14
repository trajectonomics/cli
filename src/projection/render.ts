import type { ColumnHint, RenderHint } from "../table"

/** Money reads right-aligned; a date reads left. */
const money = (key: string, label: string): ColumnHint => ({ key, label, align: "right" })

/**
 * `projection run`'s human view: the annual roll-up, the monthly rows when asked, and the notes
 * under them. Only the human Format reads it; `--json` keeps the output schema as the contract.
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
			money("interest", "interest"),
			money("unmet", "unmet"),
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
