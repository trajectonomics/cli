import { validateTransaction } from "@trajectonomics/ledger"
import { type AppError, fail } from "../errors"
import { chartOf } from "./chart"
import type { Ctx } from "./context"
import { write } from "./guard"
import { iso, newId } from "./ids"
import { storeChecks } from "./tx-checks"
import { canonicalDimensions, postingsOf, sameContent, txByExternalRef, txById } from "./tx-content"
import type { NewTransaction, TxAdded, TxWritten, WriteOptions } from "./types"

/** An id and timestamp the write already chose, so one write can append more than one row. */
export type Minted = { id: string; at: string }

function insertPostings(ctx: Ctx, id: string, postings: NewTransaction["postings"]): void {
	for (const [ordinal, p] of postings.entries()) {
		ctx.db.run(
			`INSERT INTO posting (tx_id, ordinal, account_id, amount, currency, dimensions)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
			[id, ordinal, p.accountId, p.amount, p.currency, canonicalDimensions(p.dimensions)],
		)
	}
}

/**
 * Validates through the core and appends one row under an id and timestamp the caller chose. The
 * store mints both inside the write, so an amendment's two rows share one clock reading.
 */
export function appendTransaction(
	ctx: Ctx,
	input: NewTransaction,
	minted: Minted,
): TxWritten<"added"> {
	const { date, postings, linkedTo, correctionKind } = input
	validateTransaction(
		{ id: minted.id, date, postings, ...(linkedTo === undefined ? {} : { linkedTo }) },
		chartOf(ctx),
	)
	ctx.db.run(
		`INSERT INTO tx (id, entity_id, date, memo, linked_to, external_ref, correction_kind, version,
		created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?8)`,
		[
			minted.id,
			ctx.entityId,
			date,
			input.memo ?? null,
			linkedTo ?? null,
			input.externalRef ?? null,
			correctionKind ?? null,
			minted.at,
		],
	)
	insertPostings(ctx, minted.id, postings)
	return { status: "added", tx: txById(ctx, minted.id)!, postings: postingsOf(ctx, minted.id) }
}

/** Validates through the core and appends the row; the store mints its one id, inside the write. */
export function insertTransaction(ctx: Ctx, input: NewTransaction): TxAdded {
	const at = ctx.clock()
	return appendTransaction(ctx, input, { id: newId(at), at: iso(at) })
}

function replay(ctx: Ctx, input: NewTransaction, externalRef: string): TxAdded | AppError | null {
	const stored = txByExternalRef(ctx, externalRef)
	if (!stored) return null
	if (sameContent(ctx, stored, input)) {
		return { status: "duplicate", tx: stored, postings: postingsOf(ctx, stored.id) }
	}
	return fail("external_ref_conflict", {
		path: "externalRef",
		details: { externalRef, txId: stored.id },
	})
}

/**
 * One row's outcome inside a write that is already open: replay its reference, run the store's
 * checks, or append it under an id and timestamp the caller supplies. It reads no clock itself,
 * so a batch can mint every row from one reading.
 */
export function attemptTransaction(
	ctx: Ctx,
	input: NewTransaction,
	mint: () => Minted,
): TxAdded | AppError {
	const replayed = input.externalRef === undefined ? null : replay(ctx, input, input.externalRef)
	if (replayed !== null) return replayed
	return storeChecks(ctx, input) ?? appendTransaction(ctx, input, mint())
}

/** Validates through the core, then appends. A repeated `externalRef` is idempotent. */
export function addTransaction(
	ctx: Ctx,
	input: NewTransaction,
	options: WriteOptions = {},
): TxAdded | AppError {
	return write(
		ctx.db,
		() =>
			attemptTransaction(ctx, input, () => {
				const at = ctx.clock()
				return { id: newId(at), at: iso(at) }
			}),
		options,
	)
}
