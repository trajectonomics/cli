# trajectonomics

The trajectonomics command line. The sources are Bun-only; a released binary needs nothing.

## Install

Linux and macOS, one line (verifies the release checksum, installs `traj` to `~/.local/bin`,
or `$TRAJ_INSTALL_DIR`, and prints what it installed):

```bash
curl -fsSL https://github.com/trajectonomics/cli/releases/latest/download/install.sh | sh
```

Windows, one line (installs to `%LOCALAPPDATA%\traj\bin`, adds it to the user `PATH` once,
and needs a new shell afterwards):

```powershell
irm https://github.com/trajectonomics/cli/releases/latest/download/install.ps1 | iex
```

npm, on any machine with Node 20 or later, or with Bun (`npx` needs no Bun; the package
fetches the release binary on first run and caches it under `~/.traj/bin`):

```bash
npx @trajectonomics/cli@latest --version
bunx @trajectonomics/cli@latest --version
```

Which channel: all three end at the same compiled binary and the same version. Use the
script for a machine that should keep `traj` on `PATH`, npm when you already have Node or
Bun and want one command. Pin a release with `TRAJ_VERSION=X.Y.Z` for the script, or
`@X.Y.Z` for npm.

Uninstall by deleting the one file: `~/.local/bin/traj`, `%LOCALAPPDATA%\traj\bin`,
`~/.traj/bin` (the download cache), or nothing at all for `npx`.

## Development

```bash
bun install
bun run dev -- --help     # run from source
bun test
bun run build             # single-file binary at dist/traj
bun run lint              # Biome, zero warnings
bun run format            # Biome format + import order, writes files
bun run check             # lint + typecheck + test + build, what CI runs
```

From a checkout, run the CLI with `bun run dev -- …`. The npm launcher refuses the
`0.0.0` a checkout carries, because that version is never a release; set
`TRAJ_BINARY_PATH` to run a binary you built with `bun run build`.

## Reading the future

Three read-only commands run a stored Scenario over the Baseline the ledger
states at a date: `traj projection run` rolls net worth up year by year,
nominal and real (monthly rows with `--monthly`); `traj projection compare`
puts two Scenarios side by side, or one against a `--set` what-if, with the
deltas in FI date, net worth at the ages you name and run-out year; and
`traj fi` reports the survival FI date beside the 25× rule of thumb as a
labelled reference. Every result states its As-of, the engine version, the
Scenario's hashes, the Overrides it applied, and that tax is not applied yet.
`traj schema <command>` describes each one.

## Docs

- [`GLOSSARY.md`](GLOSSARY.md): the project's vocabulary.
- [`docs/adr/`](docs/adr/): design decisions and why.
- [`docs/runbooks/releasing.md`](docs/runbooks/releasing.md): cutting and repairing a release.
- [`ROADMAP.md`](ROADMAP.md): phases and recorded next steps.

## Adding a command

Create `src/commands/<name>.ts` (or `src/commands/<group>/<name>.ts` for a
nested one) with `defineCommand`: a summary, an input schema, an output schema,
examples, the error codes it raises, and a `run` that returns `ok(data)` or
`fail(code)`. Register it in `src/commands/index.ts`, inside a `defineGroup` if
it is nested. Fields of the input schema that are not positionals become flags
automatically (`fromDate` is `--from-date`). A new failure is a new entry in the
registry in `src/errors.ts` with its exit class. Commands never format output or
exit; `traj help <path>` and `traj schema <path>` are generated from the same
schemas that validate them. Test through `run(argv, io, env)`, which needs no
process. See ADR 0015.
