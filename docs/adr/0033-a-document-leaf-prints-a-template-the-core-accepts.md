# A document leaf prints one template its core accepts

`tx import --template` prints its CSV header, so a person learns the shape before the first
rejection. `scenario apply` had no equivalent: `traj help scenario apply` described the flags, and
the first document was refused at `document.schemaVersion: UNSUPPORTED_SCHEMA_VERSION`. So a leaf
with a document form may print one template: `traj scenario apply --template` prints one complete
Scenario document, takes no name, reads no stdin and opens no data directory, and `--json` returns
it as a JSON string, exactly as `traj tx import --template` behaves (ADR-0025). ADR-0025's reason for
rejecting a sample CSV row does not apply here: a Scenario is a set of assumptions the user edits
anyway, so saving and applying the template unchanged writes nothing false, while a template that
could not be applied would be worse than none.

The template's `schemaVersion` is not written down in the CLI. ADR-0024 forbids a literal version,
and the pin has already moved from 1 to 4 (ADR-0031), so the CLI asks the pinned `sim-core` which
version it accepts: `check()` runs over a bounded range of positive integers and the highest one with
no `UNSUPPORTED_SCHEMA_VERSION` at `scenario.schemaVersion` wins, memoized, four calls today. One
module owns the document text, and a test proves that text is a document the same pin accepts, so a
pin bump the CLI does not follow fails in CI rather than in a user's first attempt. The same number
is what `traj schema <command>` prints as the document's `schemaVersion` `const` and what an
`UNSUPPORTED_SCHEMA_VERSION` refusal names, with a hint pointing at `traj schema scenario apply`, so
the three channels cannot disagree.

## Considered options

Hard-coding the version was rejected by ADR-0024 and by the pin's history: a stale literal makes the
template the CLI prints a document the CLI refuses. Exporting `SCENARIO_SCHEMA_VERSION` from
`sim-core`'s package root would remove the scan, but it needs a core release and a pin bump to save
four calls, so it was rejected for this change. Printing an empty skeleton was rejected because a
Scenario with no Stream teaches nothing about `flows`, and the field names are most of what a
template is for. A general "a document leaf prints a template" facility was deferred until a second
leaf needs one: `scenario apply` declares the flag in its own input schema, as `tx import` does.

## Consequences

A `sim-core` pin that accepts no version inside the scan's bound makes `--template` fail as
`internal` and leaves the refusal without a version; the validity test fails first, so this is a
maintainer's problem, not a user's. The template form makes the name optional in the input schema
while the document form still cannot work without it, so `DocumentSpec` gains the fields a document
form requires, checked before the document is read (ADR-0020), which is also what keeps the document
form's usage line showing a required name.
