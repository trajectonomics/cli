# A leaf may declare a document schema, and `-` reads it from stdin

Flags cannot express an n-posting transaction, and two of `tx add`'s three contract flows need exactly that: a four-posting salary and a loan split. So a leaf may declare **one** additional `document` schema beside its input schema. The input schema stays the single source of its flags — `required`, usage and `traj schema` still come from it — and the document schema is printed by `traj schema <path>` as the second accepted shape. The two forms are mutually exclusive; passing both is `invalid_input`, and neither is inferred.

A document field given as `-` is read from stdin, otherwise from a path resolved against the working directory. Reading stdin is never inferred from a terminal: `-` is the only way to ask for it. The rule is stated once here because `scenario apply -f -` needs it too.

## Considered options

A second leaf per document form was rejected: the available names all collide with the glossary (`tx post` would mean Posting, `tx record` is a synonym of Add, `tx import` is #13), and `tx amend` would need yet another leaf for its replacement. Merging the two shapes into one optional-fields schema was rejected because it erases `required` from usage and the JSON Schema, which is the drift ADR-0015 exists to prevent. Detecting a piped stdin was rejected: ADR-0010 forbids inferring anything from a terminal.

## Consequences

`Command` and `Leaf` gain an optional document schema; `traj schema <path>` gains a second input shape and usage a second form. Tests must inject stdin, as they already inject the environment and the clock. A `-` read from a terminal blocks until end-of-input, which is explicit rather than accidental; an empty document is `invalid_input`.
