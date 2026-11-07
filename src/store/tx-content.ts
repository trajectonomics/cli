import { canonicalJson } from "./canonical"
import { POSTING_COLUMNS, TX_COLUMNS } from "./columns"
import type { Ctx } from "./context"
import type { NewPosting, NewTransaction, PostingRow, TxRow } from "./types"

type StoredPosting = Omit<PostingRow, "dimensions"> & { dimensions: string | null }

/** Absent and empty dimensions are the same thing, stored as NULL; otherwise canonical JSON. */
export function canonicalDimensions(dimensions: NewPosting["dimensions"]): string | null {
	if (dimensions === undefined || Object.keys(dimensions).length === 0) return null
	return canonicalJson(dimensions, "dimensions")
}

export function postingsOf(ctx: Ctx, txId: string): PostingRow[] {
	return ctx.db
		.query<StoredPosting, [string]>(
			`SELECT ${POSTING_COLUMNS} FROM posting WHERE tx_id = ?1 ORDER BY tx_id, ordinal`,
		)
		.all(txId)
		.map(parsePosting)
}

export function parsePosting(row: StoredPosting): PostingRow {
	return { ...row, dimensions: row.dimensions === null ? null : JSON.parse(row.dimensions) }
}

export function txById(ctx: Ctx, id: string): TxRow | null {
	return ctx.db
		.query<TxRow, [string, string]>(`SELECT ${TX_COLUMNS} FROM tx WHERE id = ?1 AND entity_id = ?2`)
		.get(id, ctx.entityId)
}

export function txByExternalRef(ctx: Ctx, externalRef: string): TxRow | null {
	return ctx.db
		.query<TxRow, [string, string]>(
			`SELECT ${TX_COLUMNS} FROM tx WHERE entity_id = ?1 AND external_ref = ?2`,
		)
		.get(ctx.entityId, externalRef)
}

type Content = Pick<TxRow, "entityId" | "date" | "linkedTo" | "memo"> & {
	postings: readonly Pick<PostingRow, "accountId" | "amount" | "currency" | "dimensions">[]
}

function contentKey(content: Content): string {
	const postings = content.postings.map((p) => [p.accountId, p.amount, p.currency, p.dimensions])
	return canonicalJson([content.entityId, content.date, content.linkedTo, content.memo, postings])
}

/** Identical content: `(entity, date, linked_to, memo)` and the ordered postings' values. */
export function sameContent(ctx: Ctx, stored: TxRow, input: NewTransaction): boolean {
	const incoming: Content = {
		entityId: ctx.entityId,
		date: input.date,
		linkedTo: input.linkedTo ?? null,
		memo: input.memo ?? null,
		postings: input.postings.map((p) => {
			const dims = canonicalDimensions(p.dimensions)
			return { ...p, dimensions: dims === null ? null : JSON.parse(dims) }
		}),
	}
	return contentKey(incoming) === contentKey({ ...stored, postings: postingsOf(ctx, stored.id) })
}
