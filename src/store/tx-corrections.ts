import { TX_COLUMNS } from "./columns"
import type { Ctx } from "./context"
import type { TxRow } from "./types"

function correctionsOf(ctx: Ctx, id: string): TxRow[] {
	return ctx.db
		.query<TxRow, [string, string]>(
			`SELECT ${TX_COLUMNS} FROM tx WHERE entity_id = ?1 AND linked_to = ?2
			ORDER BY created_at, id`,
		)
		.all(ctx.entityId, id)
}

function liveCorrectionIn(ctx: Ctx, id: string, path: ReadonlySet<string>): TxRow | null {
	if (path.has(id)) throw new Error(`correction cycle at transaction ${id}`)
	const next = new Set(path).add(id)
	for (const correction of correctionsOf(ctx, id)) {
		// A reversal is the row that cancels the target; a replacement only restates it, so an
		// amendment never outlives its own reversal when the chain is walked (ADR-0021).
		if (correction.correctionKind === "replacement") continue
		if (liveCorrectionIn(ctx, correction.id, next) === null) return correction
	}
	return null
}

/**
 * The reversal that currently cancels this transaction, or null when the transaction stands. A
 * cancellation of a cancellation restores the original (ADR-0021).
 */
export function liveCorrection(ctx: Ctx, id: string): TxRow | null {
	return liveCorrectionIn(ctx, id, new Set())
}
