import { LedgerValidationError } from "@trajectonomics/ledger"
import { type AppError, fail, isAppError } from "../errors"
import type { Ctx } from "./context"
import { write } from "./guard"
import { iso, newId } from "./ids"
import { fromLedgerError } from "./ledger-errors"
import { attemptTransaction, type Minted } from "./transactions"
import type { ImportRejection, NewTransaction, TxAdded, WriteOptions } from "./types"

/** The same row the command will pick: the highest Exit class, ties by the earliest index. */
function rejectionEnvelope(rows: readonly ImportRejection[]): AppError {
	const winner = rows.reduce((best, row) =>
		row.reason.exitCode > best.reason.exitCode ? row : best,
	)
	const reason = winner.reason
	return fail(reason.code, {
		message: reason.message,
		...(reason.path === undefined ? {} : { path: reason.path }),
		...(reason.hint === undefined ? {} : { hint: reason.hint }),
		details: { rows },
	})
}

/** A row's outcome, with the core rejecting one row instead of aborting the batch. */
function rowOutcome(ctx: Ctx, input: NewTransaction, minted: Minted): TxAdded | AppError {
	try {
		return attemptTransaction(ctx, input, () => minted)
	} catch (error) {
		if (error instanceof LedgerValidationError) return fromLedgerError(error)
		throw error
	}
}

/**
 * Writes every built row in one transaction, in input order, so a later reference sees the row
 * before it. The batch reads the clock once, so every row it adds shares one timestamp. Any
 * rejection rolls the whole batch back and lists every rejected row by its index (ADR-0025).
 */
export function importTransactions(
	ctx: Ctx,
	inputs: readonly NewTransaction[],
	options: WriteOptions = {},
): readonly TxAdded[] | AppError {
	return write(
		ctx.db,
		() => {
			const at = ctx.clock()
			const stamp = iso(at)
			const written: TxAdded[] = []
			const rejected: ImportRejection[] = []
			for (const [index, input] of inputs.entries()) {
				const outcome = rowOutcome(ctx, input, { id: newId(at), at: stamp })
				if (isAppError(outcome)) rejected.push({ index, reason: outcome.body })
				else written.push(outcome)
			}
			return rejected.length === 0 ? written : rejectionEnvelope(rejected)
		},
		options,
	)
}

/** The rows a batch rejected, read back from the envelope it returned; else undefined. */
export function importRejections(error: AppError): readonly ImportRejection[] | undefined {
	const { details } = error.body
	if (typeof details !== "object" || details === null || !("rows" in details)) return undefined
	const rows: unknown = (details as { rows: unknown }).rows
	return Array.isArray(rows) ? (rows as readonly ImportRejection[]) : undefined
}
