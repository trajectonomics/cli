# Commands form a tree, flags come from the input schema, and registration is explicit

Commands are a tree of **groups** (`tx`) and **leaves** (`tx add`). A group has only a name, a summary and children; a leaf has the input schema, output schema and `run`. The dispatcher consumes words down the tree while the current node is a group; once it reaches a leaf, every remaining token is that leaf's own arguments, so `traj tx add --amount 5 cash` never mistakes `cash` for a subcommand. A bare group is `invalid_input` at exit 2 (see the Addendum, which supersedes the exit-0 rule this ADR first stated); a missing child is `unknown_command` naming the whole path (`tx nope`).

A leaf's flags are derived from its zod input schema: every field that is not a declared positional is a flag, named in kebab-case (`fromDate` is `--from-date`). Supported field types are string, number, boolean and arrays of those; anything else fails when the command is defined, and so does a name colliding with `--json`, `--help` or `--version`, two fields mapping to one flag, an input schema that is not strict, a child name that starts with `-`, and a positional that is not a field, is repeated, or is not a string. The mistake surfaces at load, not at first use. Number flags accept plain decimals only (`3`, `-2.5`), never `0x10`, `1e3` or `Infinity`. Positionals are always strings, since only flags are coerced; a value that must be a number is a flag. The last positional may be an array and takes all remaining words (`traj schema tx add`). Strictness is per leaf: a flag the leaf does not declare is `unknown_flag`, and parser errors are reworded by the CLI so messages never depend on the runtime's wording. `-v` and `--version` are flags like `--help`: they count only before a bare `--`, and the command path is checked first, so `traj nope -v` is `unknown_command`.

Usage text (`traj <path> --help`, `traj help <path>`) and `traj schema <path>` are both built from the same definitions, so what is accepted, what is documented and what is described cannot drift. The tree is registered explicitly in `src/commands/index.ts`, with one file per leaf and one folder per group.

## Considered options

Registering `"tx add"` as a literal name in a flat table was rejected: groups could not print their own usage, and nothing would stop `tx add` and `tx` from colliding. A hand-written `flags` list next to the schema was rejected because it is a second source of truth that drifts. Auto-discovering command files with a glob was rejected: it is hostile to `bun build --compile` and makes listing order depend on the filesystem, which breaks the determinism rule.

## Consequences

Flags must follow the command path: `traj --amount 5 tx add` reads `5` as a subcommand. Global boolean flags may appear anywhere. A test fails if a file under `src/commands/` exports a leaf that the tree does not reach.

Deferred, not decided here: a lazy database handle on the command context (waits for the schema in #5). Rendering hints for table-shaped results are decided in ADR-0027.

## Addendum

This ADR first required a bare group to print its usage and exit 0. That rule is **superseded**: a group below the root named with no command is `invalid_input` at exit 2, with the hint `Run "traj help <path>" to list its commands.`, and nothing on stdout. Bare `traj` and bare `traj help` still list the commands at exit 0, and `<group> --help` and `traj help <group>` still print the usage at exit 0.

The exit-0 rule was wrong about who reads the exit code. This CLI is operated by an agent (ADR 0001), and its exit code is the class of what happened (ADR 0010, ADR 0013): an agent that drops a word from a command path read `ok`, believed it had a result, and answered with none, while a shell pipeline captured usage prose into a file it took for data. The registry already has a class for a malformed command line — `invalid_input`, which a leaf given too many words also raises — so the fix adds no code and no envelope field. The usage is not lost: it is one command away, through the hint, and the two explicit doors keep it. The router therefore reads the consumed path to tell the root from every other group, and honours `--help`/`-h` before it decides, which is also where it already honoured `--version`/`-v`.

## Addendum: input validation and the envelope's path

"Parser errors are reworded by the CLI" covers the input schema too, not only the argument parser. A validation failure's sentence comes from the CLI's fixed table, and its `path` names the flag the caller typed (`--as-of`) rather than the schema field (`asOf`); a document-form failure names `document.` plus the path inside the document, and a positional keeps its declared name. The validator may reword its own messages because none of them reach the envelope.
