import { canonicalDimensions } from "./tx-content"
import type { RestoreRows } from "./types"

type Binding = string | number | null
export type Table = keyof RestoreRows
type Inserts = { [T in Table]: { sql: string; values: (row: RestoreRows[T][number]) => Binding[] } }

const SYNC_COLUMNS = "version, created_at, updated_at"

// Every value is written as given: nothing here reads the clock or derives a column.
export const INSERTS: Inserts = {
	entity: {
		sql: `INSERT INTO entity (id, name, ${SYNC_COLUMNS}, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
		ON CONFLICT (id) DO UPDATE SET name = excluded.name, version = excluded.version,
		created_at = excluded.created_at, updated_at = excluded.updated_at,
		deleted_at = excluded.deleted_at`,
		values: (r) => [r.id, r.name, r.version, r.createdAt, r.updatedAt, r.deletedAt],
	},
	account: {
		sql: `INSERT INTO account (id, entity_id, name, type, currency, parent_id, archived_at,
		${SYNC_COLUMNS}, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
		values: (r) => [
			r.id,
			r.entityId,
			r.name,
			r.type,
			r.currency,
			r.parentId,
			r.archivedAt,
			r.version,
			r.createdAt,
			r.updatedAt,
			r.deletedAt,
		],
	},
	tx: {
		sql: `INSERT INTO tx (id, entity_id, date, memo, linked_to, external_ref, ${SYNC_COLUMNS},
		correction_kind) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
		values: (r) => [
			r.id,
			r.entityId,
			r.date,
			r.memo,
			r.linkedTo,
			r.externalRef,
			r.version,
			r.createdAt,
			r.updatedAt,
			r.correctionKind,
		],
	},
	posting: {
		sql: `INSERT INTO posting (tx_id, ordinal, account_id, amount, currency, dimensions)
		VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
		values: (r) => [
			r.txId,
			r.ordinal,
			r.accountId,
			r.amount,
			r.currency,
			canonicalDimensions(r.dimensions ?? undefined),
		],
	},
	scenario: {
		sql: `INSERT INTO scenario (id, entity_id, name, document, content_hash, forked_from,
		${SYNC_COLUMNS}, deleted_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)`,
		values: (r) => [
			r.id,
			r.entityId,
			r.name,
			r.document,
			r.contentHash,
			r.forkedFrom,
			r.version,
			r.createdAt,
			r.updatedAt,
			r.deletedAt,
		],
	},
}
