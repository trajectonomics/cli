# The error envelope names its own exit class, and one registry defines every code

A JSON error is `{"error":{"code","exitCode","message","path?","hint?","details?"}}`: the string `code` identifies the failure, and the numeric `exitCode` names its class. Both come from one CLI-owned registry keyed `Record<ErrorCode, { exit, message }>`, typed so a single code can never carry two classes — a situation that needs two classes is two codes. Commands return a `Result` or an `AppError` and never a bare number, so `fail()` is the only path that produces an error and the envelope's `exitCode` and the process exit status are the same lookup. `traj schema` prints the registry sorted by code; `traj schema <command>` lists the codes that command raises by reference, because global codes such as `unknown_flag` fire before any command is resolved.

## Considered options

Carrying only the string `code` and letting `traj schema` publish the mapping was rejected as the obvious-but-wrong choice. The mapping only helps a caller that already holds it, and a caller meeting a code it has never seen — from a CLI newer than its own — is exactly the caller that needs the class. `$?` cannot stand in for it either: `traj … --json | jq` reports `jq`'s status, and a future MCP tool result carries the payload but not the exit status.

The redundancy objection against duplicating the class does not apply here, because both values are derived from one table rather than maintained by hand, and `fail()` is the only writer.

## Consequences

Consumers will branch on the coarse `exitCode` and ignore `code`, so reclassifying a code later is a wire-format break rather than a `$?` change nobody checks. Get the classes right before the MCP server ships, and record each code's class in the registry rather than only in behaviour.

The envelope is not fully self-contained for failures that kill the process before the registry runs — out-of-memory, a native `bun:sqlite` panic, a segfault. Those exit 1 with text on stderr. The `internal` catch-all is a fixed string with diagnostics behind `TRAJ_DEBUG=1`, so the bytes never vary by runtime, path or version.

## Addendum

`path` names the caller's input, never the validator's field: `--as-of` for a flag, a positional's declared name (`file`) for a bare word, and a dotted path inside a document for a field there (`document.postings.0.amount`). `invalid_input`'s sentence comes from a fixed CLI-owned table beside this registry, one row per validation reason — a required flag, a required argument, a required document field, a value that is not a number or not a whole number, an empty value, a value outside its range, a value that is not one of the allowed choices, an unexpected document field, a document that does not match its schema — and never from the validation library, which stays free to reword its own text. The table is deliberately not listed by `traj schema`: it names no new code and splits no exit class, so one `invalid_input` row per class remains what a caller branches on, and `details` rows use the same words.

The rule binds `invalid_input` first. The other codes that name an input field today (`INVALID_DATE` at `asOf`, `not_found` at `scenario`, a core's `UNKNOWN_ACCOUNT` at `from`) still carry a schema or core field and follow later: a command-raised path with no dot can be a document field that shares a flag's name, so rewriting them needs the document's provenance stated first. Codes and exit classes never change, as the Consequences above require.
