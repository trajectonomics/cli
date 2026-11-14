import { project } from "@trajectonomics/sim"
import type { AppError } from "../errors"
import { isAppError } from "../errors"
import { echoOf } from "./echo"
import { refusal } from "./engine"
import type { Prepared } from "./prepare"
import { annualRow, monthlyRow, runsOutView } from "./rows"
import type { ProjectionRunView, ProjectionTable } from "./run-view"

/**
 * `traj projection run`: the engine's Projection in the CLI's money, annual by default and with
 * the monthly rows when asked. It computes nothing the engine does not report (ADR-0030).
 */
export function projectionOf(prepared: Prepared, monthly: boolean): ProjectionRunView | AppError {
	const { timeline, baseline, currency } = prepared
	const result = project(baseline, prepared.document, timeline)
	if (!result.ok) return refusal(result.problems)
	const { projection } = result
	const annual = []
	for (const rollup of projection.annual) {
		const row = annualRow(rollup, projection.rows, currency)
		if (isAppError(row)) return row
		annual.push(row)
	}
	const tables: ProjectionTable[] = [{ name: "annual", count: annual.length, rows: annual }]
	if (monthly) {
		tables.push({
			name: "monthly",
			count: projection.rows.length,
			rows: projection.rows.map((row) => monthlyRow(row, currency)),
		})
	}
	return {
		...echoOf(prepared),
		horizon: timeline.horizon,
		currency,
		runsOut: runsOutView(projection.runsOut, currency),
		tables,
	}
}
