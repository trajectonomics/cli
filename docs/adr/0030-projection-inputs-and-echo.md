# Projections take every input from flags and echo what they were computed from

`projection run`, `projection compare` and `fi` are read-only and take their inputs from the caller, never from the clock, the data or a default. `--as-of` is required (ADR-0029, ADR-0018), `--scenario` is required on all three, and `--horizon DATE` is required: the engine's Timeline needs one, and a Scenario document cannot hold it, a birth date or FI settings because `sim-core` owns the Scenario model and rejects unknown keys (ADR-0024). `--birth-date` is optional and only turns dates into ages for `compare --age N`. A stored profile that would supply these is a later Spec: it would change the store, which is hard to undo, and a flag can be defaulted from it later without breaking a caller.

Every result carries `asOf`, `engine` (package and version), `scenario` (id, name, `contentHash` and the `effectiveContentHash` after Overrides), the applied `overrides` in command-line order and `tax`, so a result can be reproduced and an agent can tell what it was computed from (ADR-0007). `tax` is a closed enum, `applied | not_applied`; it is `not_applied` until a tax core is wired in, and the human format says so. Keys are camelCase, as in `baseline show`.

A Projection's rows are a table-shaped result: `projection run` carries them as table entries (`annual`, and `monthly` with `--monthly`) and declares ADR-0027's hint, so a person reads a table and the note under it. The echo's other fields stay in `--json`, which is the contract; the note is the one sentence a person must read.

FI is the `survival` method with the engine's defaults: no retirement spending override and no minimum buffer (ADR-0008). The 25× figure is a labelled reference and never changes the FI date. Unreachable FI reports the engine's binding and, except for `noCandidateMonth`, its best case.

An engine problem is `projection_refused` at exit 3 with the engine's codes and paths in `details`, one code with one class (ADR-0013). A Timeline problem is `invalid_input` at the flag that caused it.

## Considered options

Defaulting `--scenario` to "the only Scenario" was rejected: the answer would change when a second Scenario is saved while the arguments do not. Reading the horizon from the Scenario was rejected because the core's schema is strict and the CLI does not grow a second Scenario model. Computing real figures at an annual roll-up's closing date in the CLI was rejected because it would reimplement engine rules; the real figure is the engine's row, labelled with its date.

## Consequences

Every call spells its horizon, and a caller who wants a profile writes a shell variable. The engine's roll-up is nominal only, so `realNetWorth` carries the date of the row it comes from.
