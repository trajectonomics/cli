# Already-true writes exit 0; a failed lookup and a conflicting name do not

A mutating command returns exit 0 when the requested end state already holds, and a status naming what it found: `duplicate` for a re-added `external_ref`, `already_archived` for closing a closed account, `already_corrected` for voiding a transaction whose effect is currently cancelled. Exit 5 is for a world that conflicts with the request: `account_name_taken`, carrying `details.accountId` for the existing row, because exit 0 would hide a type mismatch between the two; `scenario_name_taken`, carrying `details.scenarioId`, for the same reason. Exit 4 is for a lookup miss: one `not_found` code carrying `details.resource` in `account|transaction|scenario`, not one code per table, since the class is identical.

`scenario rm` is the one deliberate exception to the retry rule. A tombstone never resolves, and a freed name may already belong to a new Scenario, so a name-based retry cannot safely mean "already deleted"; an id-only `already_deleted` status would give the command two contracts. The command therefore reports `not_found` at exit 4 after the end state has been reached, because the target no longer names a live Scenario.

`already_corrected` asks whether the transaction is cancelled **now**, not whether it was ever cancelled. A reversal is cancelled when something voids it, and that in turn when something voids the reversal, so the store walks the chain before answering: a transaction whose reversal has itself been reversed is live and accepts another void. The check runs before the `external_ref` replay, so a retry that both reuses a reference and targets a corrected transaction reports the correction rather than the reference. No status or detail may say *which* kind of correction it found: a reversal and an amendment's replacement are linked to the original the same way, and the link cannot tell them apart.

A posting that names a missing account is not a failed lookup of the command's target: it stays the core's `UNKNOWN_ACCOUNT` at exit 3. Two paths to one condition would give it two classes.

Mutating commands return the full rows they wrote — the account, the transaction with its postings — with amounts as decimal strings plus currency (ADR-0009), never a bare id.

## Considered options

Exit 0 for `account_name_taken` was rejected: an account of that name may exist with the wrong type, and the caller has to choose between reusing it and renaming. Two `not_found` codes were rejected as one class wearing two names. Mapping the posting case to `not_found` was rejected because it makes a rule of the transaction depend on whether the caller also happened to look the account up. Forbidding the correction of a correction was rejected: the ledger would hold a row no command could undo, which is the state ADR-0016 exists to prevent. Storing which kind of correction a row is would make `already_corrected` say more, but the column is amend's to add, not this decision's.

## Consequences

A retried mutating command is safe: exit 0 means either it wrote, or the world already matched, except for `scenario rm` as stated above. Exit 5 always needs a human to choose.

## Addendum

`correction_kind` is the column this ADR left to amend. Schema version 2 adds `tx.correction_kind`, holding `reversal` or `replacement`, so a reversal and an amendment's replacement are no longer indistinguishable to the link. The "No status or detail may say *which* kind" rule is not broken by that column: it binds `already_corrected` and the details the mutating commands report, not a reader asking a link what it is. `tx show` reports the kind of the row it shows and of every row that corrects it, while a mutating command's transaction detail still carries only `linkedTo`.

`already_corrected` stays silent on the kind because it answers whether the effect is cancelled **now**, not which row cancelled it, and both `tx void` and `tx amend` retry into the same status. Naming the kind there would make one end state read two ways and hand the caller a detail its own command did not ask for; a caller that wants the kind reads the link with `tx show`.
