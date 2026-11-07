import type { Database } from "bun:sqlite"
import { PERSONAL_ENTITY_ID, PERSONAL_ENTITY_SEEDED_AT } from "./ids"

// Every aggregate root carries id, version, created_at, updated_at; deleted_at only where
// ADR-0016 allows a tombstone. `tx` has none, and `posting` carries no sync columns (ADR-0017).
const SYNC = `version INTEGER NOT NULL CHECK (version >= 1),
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL`

const DDL = `
CREATE TABLE entity (
	id TEXT PRIMARY KEY NOT NULL,
	name TEXT NOT NULL,
	${SYNC},
	deleted_at TEXT
) STRICT;
CREATE TABLE account (
	id TEXT PRIMARY KEY NOT NULL,
	entity_id TEXT NOT NULL REFERENCES entity (id),
	name TEXT NOT NULL CHECK (name <> ''),
	type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'income', 'expense')),
	currency TEXT NOT NULL,
	parent_id TEXT REFERENCES account (id),
	archived_at TEXT,
	${SYNC},
	deleted_at TEXT
) STRICT;
CREATE UNIQUE INDEX account_live_name ON account (entity_id, name) WHERE deleted_at IS NULL;
CREATE INDEX account_parent ON account (parent_id);
CREATE TABLE tx (
	id TEXT PRIMARY KEY NOT NULL,
	entity_id TEXT NOT NULL REFERENCES entity (id),
	date TEXT NOT NULL,
	memo TEXT,
	linked_to TEXT REFERENCES tx (id),
	external_ref TEXT,
	${SYNC}
) STRICT;
CREATE UNIQUE INDEX tx_external_ref ON tx (entity_id, external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX tx_entity_date ON tx (entity_id, date, id);
CREATE INDEX tx_linked_to ON tx (linked_to);
CREATE TABLE posting (
	tx_id TEXT NOT NULL REFERENCES tx (id),
	ordinal INTEGER NOT NULL CHECK (ordinal >= 0),
	account_id TEXT NOT NULL REFERENCES account (id),
	amount INTEGER NOT NULL,
	currency TEXT NOT NULL,
	dimensions TEXT,
	PRIMARY KEY (tx_id, ordinal)
) STRICT, WITHOUT ROWID;
CREATE INDEX posting_account ON posting (account_id);
CREATE TABLE scenario (
	id TEXT PRIMARY KEY NOT NULL,
	entity_id TEXT NOT NULL REFERENCES entity (id),
	name TEXT NOT NULL CHECK (name <> ''),
	document TEXT NOT NULL,
	content_hash TEXT NOT NULL,
	forked_from TEXT REFERENCES scenario (id),
	${SYNC},
	deleted_at TEXT
) STRICT;
CREATE UNIQUE INDEX scenario_live_name ON scenario (entity_id, name) WHERE deleted_at IS NULL;
`

/** Version 1: the five tables and the seeded personal entity. */
export function schemaV1(db: Database): void {
	db.run(DDL)
	db.run(
		"INSERT INTO entity (id, name, version, created_at, updated_at) VALUES (?1, 'Personal', 1, ?2, ?2)",
		[PERSONAL_ENTITY_ID, PERSONAL_ENTITY_SEEDED_AT],
	)
}
