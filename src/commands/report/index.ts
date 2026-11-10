import type { Group } from "../../command"
import { defineGroup } from "../../command"
import { networth } from "./networth"
import { pnl } from "./pnl"

export const report: Group = defineGroup({
	name: "report",
	summary: "Report on the ledger over a period or at a date",
	children: [networth, pnl],
})
