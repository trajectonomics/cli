import { validateTransaction } from "@trajectonomics/ledger"
import { type AppError, fail } from "../errors"
import { chartOf } from "./chart"
import type { Ctx } from "./context"
import { write } from "./guard"
import { iso, newId } from "./ids"
import { storeChecks } from "./tx-checks"
import { canonicalDimensions, postingsOf, sameContent, txByExternalRef, txById } from "./tx-content"
import type { NewTransaction, TxAdded, WriteOptions } from "./types"

function insert(ctx: Ctx, input: NewTransaction): TxAdded {
	const at = ctx.clock()
	const id = newId(at)
	const { date, postings, linkedTo } = input
	validateTransaction(
		{ id, date, postings, ...(linkedTo === undefined ? {} : { linkedTo }) },
		chartOf(ctx),
	)
	ctx.db.run(
		`INSERT INTO tx (id, entity_id, date, memo, linked_to, external_ref, version, created_at,
		updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)`,
		[
			id,
			ctx.entityId,
			date,
			input.memo ?? null,
			linkedTo ?? null,
			input.externalRef ?? null,
			iso(at),
		],
	)
	for (const [ordinal, p] of postings.entries()) {
		ctx.db.run(
			`INSERT INTO posting (tx_id, ordinal, account_id, amount, currency, dimensions)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
			[id, ordinal, p.accountId, p.amount, p.currency, canonicalDimensions(p.dimensions)],
		)
	}
	return { status: "added", tx: txById(ctx, id)!, postings: postingsOf(ctx, id) }
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

/** Validates through the core, then appends. A repeated `externalRef` is idempotent. */
export function addTransaction(
	ctx: Ctx,
	input: NewTransaction,
	options: WriteOptions = {},
): TxAdded | AppError {
	return write(
		ctx.db,
		() => {
			const replayed =
				input.externalRef === undefined ? null : replay(ctx, input, input.externalRef)
			return replayed ?? storeChecks(ctx, input) ?? insert(ctx, input)
		},
		options,
	)
}
