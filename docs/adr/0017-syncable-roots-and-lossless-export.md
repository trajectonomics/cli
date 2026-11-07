# Only aggregate roots are syncable, and the export is a lossless dump

An `entity`, `account`, `tx` and `scenario` each carry a client-generated UUIDv7 `id`, a `version`, `created_at`, `updated_at`, and — where ADR-0016 allows one — a `deleted_at` tombstone. A `posting` carries none of them: its key is `(tx_id, ordinal)`. Issue #5 asked for "sync-ready columns on every row", and this narrows it deliberately, because a posting can never be updated on its own. A wrong posting is corrected by voiding its transaction and adding a new one, so a per-posting `version` could only ever hold 1 and a per-posting tombstone could only ever be null.

The canonical JSONL export is a lossless dump of those rows. Records come in a fixed type order (entity, account, tx, posting, scenario), one row per line, keys in the writer's declared order, tombstones included, sync columns written verbatim and preserved on import, money as decimal strings per ADR-0009, timestamps `YYYY-MM-DDTHH:MM:SS.sssZ`. Byte-identical round trip therefore means "the restore lost nothing", not "the restore recomputed the same values". The header holds a format version and the schema version and nothing else: any wall-clock or build metadata would make two exports of the same database differ.

The schema version lives in `PRAGMA user_version`, not in a table, so the interchange document never carries the database's own bookkeeping. Scenario documents are stored as RFC 8785 (JCS) canonical bytes with an algorithm-tagged `jcs1:sha256:` hash, because `sim-core` does not exist yet and the store is in no position to understand them.

## Considered options

A `schema_migrations` table was rejected: it is a row that has to be excluded from the export, and a restore whose table disagrees with its schema version is ambiguous in exactly the situation a backup exists for.

Per-posting identifiers were rejected above. Re-deriving `updated_at` on import was rejected because it makes a backup lossy in the one field that cannot be reconstructed.

Leaving the scenario hash untagged was rejected: if canonicalisation ever changes, every stored hash silently means something else, and `fork`/`diff` would report "unchanged" for documents that changed.

## Consequences

Adding a field to a record is additive and keeps the format version; changing the meaning of an existing field is a format-version bump. `traj schema` stays a view of the CLI's own registry, not of the database.
