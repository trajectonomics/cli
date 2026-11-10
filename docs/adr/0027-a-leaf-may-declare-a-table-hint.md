# A leaf may declare a table hint, and only the human Format reads it

`inspect` is the first Result shaped as tables, and a person has to read it: a JSON dump of rows is not a table. A leaf may declare an optional `render` hint naming the result field holding the tables, the field holding each table's rows, and a column map per table with each column's key, label and alignment. `renderResult` uses it only when the Format is `human`; `--json` ignores it, so the output schema stays the contract and `traj schema` publishes the truth. ADR-0015 deferred rendering hints "for the first such command"; this decides that deferral.

The hint is a hint, not a second result shape: nothing in it can add, rename or drop a value, and the renderer only pads and aligns the already validated result. Display width comes from `Bun.stringWidth`, so a Thai combining mark does not skew the padding. A cell's backslash and every C0/C1 control character are escaped (`\n` becomes the two characters `\n`), so a memo can neither break a row nor send an escape to the terminal, and nothing is truncated. `null` and an empty string both render as an empty cell, because a table cannot tell them apart; only JSON does. When the entries carry no rows — a bare summary — the hint does not apply and the generic renderer prints the result instead.

The columns are the writer's declared column order (`FIELDS`), the same keys the JSON rows and the export use, so the human table, `--json` and the JSONL file cannot disagree. `version`, `ordinal` and `amount` are right-aligned; every other column is text.

## Considered options

Rendering the table inside the Command was rejected: a Command returns structure and never formats (ADR-0010), and a second formatting path would hide the schema. A `toText` callback on the leaf was rejected: it moves layout into each command, duplicates padding and escaping, and leaves `--json` free to drift from the human view. Formatting every array-of-objects Result as a table was rejected: only the command knows which columns to show and which read right-aligned, and a guess either hides a column or shows ids a friendly view deliberately hides.

## Consequences

`Command` and `Leaf` carry `render?`, `dispatch` passes it to `renderResult`, and JSON never reads it. A new table-shaped Result that wants the human view declares a hint and a column map; without one it keeps the generic renderer, which is what every older command does. The human output of a table-shaped Result is a presentation of the output schema, so a rendering change is a deliberate golden diff, never a data change; a Bun upgrade that changes Thai display width is exactly such a diff.
