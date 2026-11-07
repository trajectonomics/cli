# Deletion has three names, and only one is a tombstone

The ledger never deletes. A wrong transaction is corrected by a **void** (a reversing transaction) or an **amend** (a void plus a linked replacement); both only add rows. An account that is no longer used is **archived**: `archived_at` is set, it stops accepting postings, and it stays in history, reports and exports. A **tombstone** (`deleted_at`) exists only on the aggregates sync must be able to remove from another device — entity, account, scenario — and only on rows that never carried ledger meaning: an account with postings cannot be tombstoned, because its history would become unreadable.

The three are not one mechanism under different names, which is why the commands differ: `tx void`, `account close`, `scenario rm`.

## Considered options

One mechanism — soft-delete everything — was rejected because it makes a closed account and a voided transaction indistinguishable in the one place it matters: reports. A closed account still needs a balance history; a voided transaction must still appear as a reversal. Collapsing both into `deleted_at` forces every query to decide what "deleted" means for that table, which is knowledge the store should hold once instead.

Hard-deleting scenarios was considered and rejected: a scenario is a document a user iterates on, and `fork` (issue #10) needs the original to keep existing. It also monopolises the tombstone column sync needs anyway.

## Consequences

Every table states its deletion story explicitly, so a table without `deleted_at` is a claim rather than an oversight. The JSONL export carries tombstoned rows, so a restore reproduces the deletions; `archived_at` and `linked_to` are ordinary data and need no special handling on import.
