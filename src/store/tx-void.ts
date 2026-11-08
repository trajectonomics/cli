import type { AppError } from "../errors"
import type { Ctx } from "./context"
import { write } from "./guard"
import { insertTransaction } from "./transactions"
import { storeChecks } from "./tx-checks"
import { postingsOf, txById } from "./tx-content"
import { liveCorrection } from "./tx-corrections"
import { reversalOf } from "./tx-reverse"
import type { TxVoided, WriteOptions } from "./types"

/**
 * Appends the original's postings with every sign flipped, linked to it. An uncancelled
 * correction already stands, so a repeated void reports it without writing (ADR-0021).
 */
export function voidTransaction(
	ctx: Ctx,
	id: string,
	input: { date: string },
	options: WriteOptions = {},
): TxVoided | AppError {
	return write(
		ctx.db,
		() => {
			const original = txById(ctx, id)
			if (!original) return { status: "not_found" }
			// A correction already stands, so a retry reports it before the reversal is built.
			const correction = liveCorrection(ctx, original.id)
			if (correction) {
				return {
					status: "already_corrected",
					tx: correction,
					postings: postingsOf(ctx, correction.id),
				}
			}
			const reversal = reversalOf(ctx, original, input.date)
			const failure = storeChecks(ctx, reversal)
			if (failure) return failure
			const added = insertTransaction(ctx, reversal)
			return { status: "voided", tx: added.tx, postings: added.postings }
		},
		options,
	)
}
