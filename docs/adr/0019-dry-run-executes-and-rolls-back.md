# `--dry-run` executes the write and rolls it back

A dry run runs the real command against the real database, inside the same `IMMEDIATE` transaction as a real write, and rolls back before commit. It returns the rows the write would have produced, with `dryRun: true` and every generated id `null`.

It is not a separate validation path. A validate-only dry run drifts from the write path it is supposed to predict, and it cannot answer the questions that matter: `tx void`'s reversal postings are derived by the core from the original, and `tx amend` produces two transactions the input never states. Executing is the only way to show them.

## Considered options

Validate-only was rejected because a dry run exists to predict the real run, and two code paths cannot promise that. Printing generated ids was rejected too: a UUIDv7 carries random bits, so a dry-run id is never the id the next run mints; `null` states that honestly instead of inviting a caller to record it.

## Consequences

A dry run takes the writer lock, so it can fail with `database_busy` (exit 5) even though it writes nothing — which is correct, because the real write would fail the same way. The `duplicate`, `name_taken` and `already_archived` paths are exercised rather than bypassed, so a dry run reports the status the real run would return. The store gains a rollback mode in `guard`/`write` and a `{dryRun}` option on every mutating method.
