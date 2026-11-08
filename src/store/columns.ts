import type { AccountSort, EntitySort, PostingSort, ScenarioSort, TxSort } from "./types"

// SELECT lists that alias columns to the row types' keys, in column order. The only place a
// column name meets a row key.
export const ENTITY_COLUMNS = `id, name, version, created_at AS createdAt, updated_at AS updatedAt,
	deleted_at AS deletedAt`
export const ACCOUNT_COLUMNS = `id, entity_id AS entityId, name, type, currency,
	parent_id AS parentId, archived_at AS archivedAt, version, created_at AS createdAt,
	updated_at AS updatedAt, deleted_at AS deletedAt`
export const TX_COLUMNS = `id, entity_id AS entityId, date, memo, linked_to AS linkedTo,
	external_ref AS externalRef, version, created_at AS createdAt, updated_at AS updatedAt`
export const POSTING_COLUMNS = `tx_id AS txId, ordinal, account_id AS accountId, amount, currency,
	dimensions`
export const SCENARIO_COLUMNS = `id, entity_id AS entityId, name, document,
	content_hash AS contentHash, forked_from AS forkedFrom, version, created_at AS createdAt,
	updated_at AS updatedAt, deleted_at AS deletedAt`

// Each order ends on the primary key, so ties never fall back to rowid order.
export const ENTITY_ORDER: Record<EntitySort, string> = { id: "id" }
export const ACCOUNT_ORDER: Record<AccountSort, string> = {
	id: "id",
	name: "name, id",
	created_at: "created_at, id",
}
export const TX_ORDER: Record<TxSort, string> = {
	id: "id",
	date: "date, id",
	created_at: "created_at, id",
}
export const POSTING_ORDER: Record<PostingSort, string> = { tx_id: "tx_id, ordinal" }
export const SCENARIO_ORDER: Record<ScenarioSort, string> = {
	id: "id",
	name: "name, id",
	created_at: "created_at, id",
}

/** `AND deleted_at IS NULL` unless tombstones were asked for. */
export function liveOnly(includeDeleted: boolean | undefined): string {
	return includeDeleted === true ? "" : "AND deleted_at IS NULL"
}
