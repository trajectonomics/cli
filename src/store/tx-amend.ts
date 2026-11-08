import { amend, LedgerValidationError, type Transaction } from "@trajectonomics/ledger"
import { type AppError, isAppError } from "../errors"
import { chartOf } from "./chart"
import type { Ctx } from "./context"
import { write } from "./guard"
import { iso, newId } from "./ids"
import { fromLedgerError } from "./ledger-errors"
import { appendTransaction } from "./transactions"
import { externalRefTaken, storeChecks } from "./tx-checks"
import { postingsOf, txById } from "./tx-content"
import { coreTransaction } from "./tx-core"
import { liveCorrection } from "./tx-corrections"
import { correctionInput } from "./tx-reverse"
import type { NewAmendment, NewTransaction, TxAmended, TxRow, WriteOptions } from "./types"

/** The core's `amend` prefixes the reversal's fields; the envelope names the caller's own field. */
function callerField(field: string): string {
	if (field === "reversal.date") return "voidDate"
	return field.startsWith("reversal.") ? field.slice("reversal.".length) : field
}

/** The core's amendment of `original`, or its failure renamed to this command's own fields. */
function amendmentOf(
	ctx: Ctx,
	original: TxRow,
	input: NewAmendment,
	ids: { reversal: string; replacement: string },
): readonly [Transaction, Transaction] | AppError {
	const chart = chartOf(ctx)
	const stored = coreTransaction(original, postingsOf(ctx, original.id), chart)
	const replacement = input.replacement
	try {
		const reversal = { id: ids.reversal, date: input.voidDate ?? replacement.date }
		const corrected = {
			id: ids.replacement,
			date: replacement.date,
			postings: replacement.postings,
		}
		return amend(stored, { reversal, replacement: corrected }, chart)
	} catch (error) {
		if (!(error instanceof LedgerValidationError)) throw error
		return fromLedgerError(
			new LedgerValidationError(error.code, callerField(error.field), error.value, error.reason),
		)
	}
}

/** Both correction rows, built and checked, so one failure keeps either from being written. */
function correctionRows(
	ctx: Ctx,
	original: TxRow,
	input: NewAmendment,
	ids: { reversal: string; replacement: string },
): readonly [NewTransaction, NewTransaction] | AppError {
	const built = amendmentOf(ctx, original, input, ids)
	if (isAppError(built)) return built
	const [reversalTx, replacementTx] = built
	const reversal = correctionInput(reversalTx, original.id, "reversal")
	const replacement = correctionInput(replacementTx, original.id, "replacement", input.replacement)
	const broken = storeChecks(ctx, reversal) ?? storeChecks(ctx, replacement)
	return broken ?? [reversal, replacement]
}

/**
 * Appends the reversal and the replacement in one write, both linked to the original and both
 * named by `correction_kind`. An uncancelled correction already stands, so a repeated amend
 * reports it without writing (ADR-0021), before the replacement's reference is looked at.
 */
export function amendTransaction(
	ctx: Ctx,
	id: string,
	input: NewAmendment,
	options: WriteOptions = {},
): TxAmended | AppError {
	return write(
		ctx.db,
		() => {
			const original = txById(ctx, id)
			if (!original) return { status: "not_found" }
			const standing = liveCorrection(ctx, original.id)
			if (standing) {
				return {
					status: "already_corrected",
					tx: standing,
					postings: postingsOf(ctx, standing.id),
				}
			}
			const conflict = externalRefTaken(ctx, input.replacement.externalRef)
			if (conflict) return conflict
			// One clock reading and one write: a failure in the second insert writes neither row.
			const at = ctx.clock()
			const minted = { at: iso(at) }
			const ids = { reversal: newId(at), replacement: newId(at) }
			const rows = correctionRows(ctx, original, input, ids)
			if (isAppError(rows)) return rows
			const [reversal, replacement] = rows
			return {
				status: "amended",
				reversal: appendTransaction(ctx, reversal, { id: ids.reversal, ...minted }),
				replacement: appendTransaction(ctx, replacement, { id: ids.replacement, ...minted }),
			}
		},
		options,
	)
}
