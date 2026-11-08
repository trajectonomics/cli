import type { AppError } from "../errors"
import { POSTING_COLUMNS, POSTING_ORDER, TX_COLUMNS, TX_ORDER } from "./columns"
import type { Ctx } from "./context"
import { guard } from "./guard"
import { parsePosting, txById } from "./tx-content"
import { whereOf } from "./tx-filter"
import type { PostingRow, PostingSort, TxFilter, TxRow, TxSort } from "./types"

export function listTransactions(
	ctx: Ctx,
	options: { sort: TxSort } & TxFilter,
): TxRow[] | AppError {
	const where = whereOf(options)
	return guard(() =>
		ctx.db
			.query<TxRow, string[]>(
				`SELECT ${TX_COLUMNS} FROM tx WHERE entity_id = ? ${where.sql}
				ORDER BY ${TX_ORDER[options.sort]}`,
			)
			.all(ctx.entityId, ...where.params),
	)
}

/** The transaction with this id in the personal entity, or null. */
export function getTransaction(ctx: Ctx, id: string): TxRow | null | AppError {
	return guard(() => txById(ctx, id))
}

export function listPostings(
	ctx: Ctx,
	options: { sort: PostingSort; txId?: string },
): PostingRow[] | AppError {
	const narrow = options.txId === undefined ? "" : "AND tx_id = ?"
	const params = options.txId === undefined ? [ctx.entityId] : [ctx.entityId, options.txId]
	return guard(() =>
		ctx.db
			.query<Parameters<typeof parsePosting>[0], string[]>(
				`SELECT ${POSTING_COLUMNS} FROM posting
				WHERE tx_id IN (SELECT id FROM tx WHERE entity_id = ?) ${narrow}
				ORDER BY ${POSTING_ORDER[options.sort]}`,
			)
			.all(...params)
			.map(parsePosting),
	)
}
