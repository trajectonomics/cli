import { type AppError, fail, isAppError } from "../errors"
import { importRejections, type Store, type TxAdded } from "../store"
import type { Building, Built, Rejected } from "./import-build"
import { buildAll } from "./import-build"
import type { ImportRow } from "./import-csv"
import { atColumn, storeField } from "./import-paths"
import type { ImportResult } from "./import-view"
import { viewImport } from "./import-view"

type Classified = { written: readonly TxAdded[]; rejected: Rejected[] }

/**
 * The all-or-nothing rejection (ADR-0025): every rejected row in line order, the row with the
 * highest Exit class (ties by earliest line) supplying the envelope's code and class.
 */
function rejectionEnvelope(rows: readonly Rejected[]): AppError {
	const ordered = [...rows].sort((left, right) => left.line - right.line)
	const first = ordered.reduce((best, row) => (row.line < best.line ? row : best))
	const winner = ordered.reduce((best, row) =>
		row.reason.exitCode > best.reason.exitCode ? row : best,
	)
	const reason = winner.reason
	return fail(reason.code, {
		message: "The import was rejected and nothing was written.",
		...(reason.path === undefined ? {} : { path: reason.path }),
		hint: `Fix line ${first.line} first: ${first.reason.message}`,
		details: { rows: ordered },
	})
}

/** Asks the store for every built row, dry when any row already failed, and reads its rejections. */
function classify(
	built: readonly Built[],
	alreadyRejected: boolean,
	dryRun: boolean,
	store: Store,
): Classified | AppError {
	if (built.length === 0) return { written: [], rejected: [] }
	const outcome = store.importTransactions(
		built.map((row) => row.tx),
		{ dryRun: dryRun || alreadyRejected },
	)
	if (!isAppError(outcome)) return { written: outcome, rejected: [] }
	const failures = importRejections(outcome)
	if (failures === undefined) return outcome
	const rejected = failures.flatMap((failure): Rejected[] => {
		const row = built[failure.index]
		if (row === undefined) return []
		const reason = atColumn(failure.reason, storeField(failure.reason.path ?? "", row.line))
		return [{ line: row.line, externalRef: row.externalRef, status: "rejected", reason }]
	})
	return { written: [], rejected }
}

/**
 * Builds every row, then writes them in one store batch. If any row cannot be built, the batch
 * is still asked, dry, so its own rejections are reported too; either way nothing is written.
 */
export function importRows(
	rows: readonly ImportRow[],
	file: string,
	dryRun: boolean,
	store: Store,
): ImportResult | AppError {
	const building: Building = buildAll(rows, store)
	const classified = classify(building.built, building.rejected.length > 0, dryRun, store)
	if (isAppError(classified)) return classified
	const rejected = [...building.rejected, ...classified.rejected]
	if (rejected.length > 0) return rejectionEnvelope(rejected)
	return viewImport(classified.written, building.built, file, dryRun)
}
