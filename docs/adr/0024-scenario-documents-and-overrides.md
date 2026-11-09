# Scenario documents stay opaque until `sim-core`, and Overrides use dotted paths with stable ids

Scenario commands ship before `sim-core` exists. A Scenario document is therefore validated only as a JSON object with a positive-integer `schemaVersion`; every other value is preserved. The same envelope validator is used by the command's document form and by the Store's canonicaliser, so `traj schema` and the Store cannot drift. The document schema is the seam: when `sim-core` publishes the real Scenario schema, it replaces the envelope and deep validation begins. Until then, the CLI does not grow a second Scenario model.

An **Override** is a value that replaces one dotted path of a Scenario document. It is persisted only by `scenario fork --set`; a Projection applies the same Override transiently. The path grammar is shared with #11: object keys separated by dots, and list items addressed by their stable string `id`, never by array index. A literal `.`, `\` or `=` in a key is escaped with `\`; any other escape is invalid. Values are JSON literals, so a number stays a number and a string is quoted.

`--set` only replaces a path that already exists. Without a schema, a new key is indistinguishable from a typo, and the issue requires a typo to fail with a hint. A set may not change a list item's `id`; identity cannot be rewritten through a whole-item replacement. A list without stable ids can only be replaced whole by setting the list's own path. Sets apply in command-line order; an exact duplicate path is refused. An unknown path is `invalid_input` at exit 2 with `details.index`, `details.path`, `details.segment` and `details.suggestion`. The suggestion is the nearest key or id by case-sensitive Levenshtein distance when it is close enough, otherwise the hint lists the known siblings. Lookups use own properties, so prototype names never resolve.

`scenario diff` uses the same path formatter and id-keyed-list rule. It matches list items by `id`; if the common ids appear in a different relative order, the list itself is one atomic `changed` entry and its descendants are suppressed. `identical` is true only when the change list is empty, which is deep equality under those rules.

A live Scenario name is a conflict at exit 5, with the new `scenario_name_taken` code carrying `details.scenarioId`, mirroring `account_name_taken`. `scenario rm` tombstones rather than deletes and frees the name for reuse. Because a tombstone never resolves and a freed name may already belong to a new Scenario, a retry of `rm` is `not_found` at exit 4 rather than an idempotent success; this is the deliberate exception to ADR-0021's retry rule.

## Considered options

Blocking Scenario commands on `sim-core` was rejected: the Store already accepts Scenario documents, the command surface is useful before projections exist, and ADR-0017 already records why the document is opaque. Inventing a Scenario schema in the CLI was rejected as a competing model that would have to be undone when `sim-core` ships.

RFC 6902 JSON Patch was rejected for `diff`: it uses JSON Pointer and array indexes, so a user would translate between `/streams/0/amount` for a diff and `streams.salary.amount` for an Override. Positional paths also break when a list is reordered. Treating a bare non-JSON `--set` value as a string was rejected because it silently turns `50000` into a number but `001` into text.

Allowing `--set` to add a key was rejected because a typo would silently create an assumption instead of failing with the required hint. Allowing an item's `id` to change was rejected because every later path and diff would then address a different item, and duplicate ids would make resolution ambiguous.

Returning `already_deleted` at exit 0 for a retried `scenario rm` was rejected: a name-based retry may remove a new Scenario that reused the name, and an id-only exception would give the command two contracts.

## Consequences

The dotted-path grammar and JSON-literal values are a wire contract shared with #11's projection `--set`; both use one pure `applyOverrides` function and echo the applied `{ path, value }` list. `sim-core`'s schema replaces the envelope later without changing the path grammar. A `--set` that would add a key needs a whole-list replacement or a fresh `scenario apply`.

List order is visible: a reorder is a diff entry, because order may be semantic to `sim-core` and two different canonical hashes must not report `identical`. `scenario rm` is the one mutating retry that reports `not_found` after the end state, and ADR-0021 records that exception.
