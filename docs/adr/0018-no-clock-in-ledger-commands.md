# Ledger commands take an explicit date and name their accounts

Every command that writes a ledger fact takes a required `--date`; nothing derives a date from the clock. "Today" has no timezone in a CLI that runs on a laptop in Bangkok and a build server in UTC, where the two dates differ for seven hours of every day. It also decides idempotency: the duplicate rule keys on `(date, linked_to, memo, postings)`, so a clock default turns a re-added `--external-ref` into `external_ref_conflict` the next morning instead of the `duplicate` the ticket promises. `tx amend` states the replacement's date and takes the reversal's from `--void-date`, defaulting to the replacement's.

Accounts are addressed by **name**, with an id also accepted. Resolution reads an id first, then a live name, so the two never compete; `account add` rejects a name shaped like a UUID, which is the only way the order could matter. Names are exact and case-sensitive, matching the uniqueness the store already enforces among non-tombstoned rows — archived accounts included, so a closed account still resolves and still refuses postings with `account_archived`. `--json` output carries both `id` and `name`. The same id-first resolution and UUID-shaped-name refusal extend to the named Scenario aggregate, because a Scenario is named for the same reason.

## Considered options

Defaulting `--date` to the clock was rejected on the two counts above; the timezone could not be fixed without a second decision (local zone, `TZ`, or UTC), and each of those produces a date the caller never chose. Requiring ids was rejected because a UUIDv7 is untypeable and the glossary defines an account as a *named* place. Resolving names before ids was rejected: a transaction's `--from` would then silently prefer an account named like another's id.

## Consequences

A human must type the date, or let their shell supply it; an agent always has one. `tx void` on a transaction dated in the future is the core's `REVERSAL_BEFORE_ORIGINAL` (exit 3), not a silent backdate. The ledger holds no fact that a clock produced.
