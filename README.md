# trajectonomics

`traj` is a free and open source command line for personal money. An AI agent operates it.
The command line never calls a model, so every result is repeatable.

The landing page is [trajectonomics.com](https://trajectonomics.com/) and the docs are at
[trajectonomics.com/docs](https://trajectonomics.com/docs/).

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

Then give your agent the setup skill:

```bash
npx skills add trajectonomics/skills --skill traj-onboarding -y
```

The setup skill asks about your situation and goal, then its second step installs the `traj`
operating skill from `trajectonomics/skills`, the repository both skills publish from.

```bash
npx skills add trajectonomics/skills --skill traj -y
```

That is the operating skill on its own, for an agent that is already set up. Both commands
use `npx`, so they need Node, which the npm channel already requires; the install scripts
do not.

Which channel: all three end at the same compiled binary and the same version. Use the
script for a machine that should keep `traj` on `PATH`, npm when you already have Node or
Bun and want one command. Pin a release with `TRAJ_VERSION=X.Y.Z` for the script, or
`@X.Y.Z` for npm.

Uninstall by deleting the one file: `~/.local/bin/traj`, `%LOCALAPPDATA%\traj\bin`,
`~/.traj/bin` (the download cache only; your ledger is beside it), or nothing at all for
`npx`.

`traj` keeps the ledger in `~/.traj/traj.db`, or in `traj.db` inside `TRAJ_HOME` when that is
set, the same path on Linux, macOS and Windows. Beside it is the disposable `bin/` download
cache; deleting the data directory deletes the ledger. Take a lossless copy with:

```bash
traj export --format jsonl --out backup
```

`--out` names a directory that must not exist yet, and JSONL is the only lossless export
format.

## Development

The sources are Bun-only; a released binary needs nothing.

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

> **Ships in 0.2.0.**
> The release you installed has no `projection`, `fi` or `scenario tax`: they are on `main`
> and reach the install channels with `0.2.0`.

Three read-only commands run a stored Scenario over the Baseline the ledger
states at a date: `traj projection run` rolls net worth up year by year,
nominal and real (monthly rows with `--monthly`); `traj projection compare`
puts two Scenarios side by side, or one against a `--set` what-if, with the
deltas in FI date, net worth at the ages you name and run-out year; and
`traj fi` reports the survival FI date beside the 25× rule of thumb as a
labelled reference. Every date flag is a Gregorian year between 1900 and
2100, so a Buddhist year is refused instead of read as 543 years later. Every result states its As-of, the engine version, the
Scenario's hashes, the Overrides it applied, and its tax status.
`traj schema <command>` describes each one.

Each result also says what every tax year owes: `taxYears` in JSON, and the
`taxYears` table in the human format. A row names its Levy, the period and the
day it settles, what it owed before Prepayment, what was already paid at source,
and the `owed` figure — due minus prepaid, so a refund is negative. `settled`
says whether the settlement date falls inside the Projection, and `partial`
whether the Projection ended before the period did, so a figure that is still
ahead of you is never mistaken for one already charged.

Tax is the Scenario's. `traj scenario tax <name> --tax th-2026` writes Thailand's
2026 personal income tax into it, and `--label salary=income.section40_1` says
which Section 40 class each income Flow belongs to, because a Levy tallies
labels and never guesses them; `--none` takes both out again, with the
Prepayments that named the Levy. A Scenario without the Levy is projected
pre-tax, and every result says which it is.

A real employee's profile goes in on the same command: `--filing-status`,
`--children`, `--parents`, `--disabled-care`, `--social-security`,
`--life-insurance`, `--health-insurance`, `--parent-health-insurance`,
`--spouse-life-insurance`, `--mortgage-interest`, `--donation2x` and
`--donation1x`, each in THB except the counts. `@trajectonomics/tax` applies
every statutory ceiling; the CLI holds no amount of its own. The write reports
which deduction classes the flags stated and which they left out, so a
deduction nobody stated is visible rather than assumed to be zero. It states
what the flags said, never what tax-core applied: a premium the statute does
not allow for the filing status is still stated, and the Levy zeroes it.

```json
{
  "status": "updated",
  "allowances": {
    "stated": ["lifeInsurance"],
    "notStated": ["children", "socialSecurity", "mortgageInterest", "donation1x"]
  }
}
```

A Projection that starts inside a tax period also needs what that period had
already taken: `--carry-in carry-in.json` states it, one record per Scenario,
Levy and period, with a `"0.00"` for every class the period had no income in or
one `"rest": "0.00"` for all the rest. The result echoes every record it used
and where it came from, and one that starts on a period boundary needs nothing:

```json
[
  {
    "scenario": "base",
    "levy": "th-2026-pit",
    "periodStart": "2026-01-01",
    "tallies": [{ "label": "income.section40_1", "basis": "gross", "amount": "0.00" }],
    "prepaid": "0.00",
    "rest": "0.00"
  }
]
```

## Keeping a backup, and removing the data

> **Ships in 0.3.0.**
> The release you installed has no `doctor`, `backup`, `restore` or `data remove`: they are on
> `main` and reach the install channels with `0.3.0`.

Four commands keep the ledger recoverable. `traj doctor` checks the data directory, the
database and every stored transaction and says what is wrong without changing anything;
`--as-of` adds the trial balance at a date. It exits 0 when its checks ran, with `"ok": false`
when one found a problem, because the finding is the answer; a non-zero exit is for what the
command could not do at all.

`traj backup --out backup` writes `traj.jsonl`, the canonical dump, into a directory that must
not exist yet, and `traj restore backup` writes it into an empty data directory byte for byte.
A restore refuses a database that already holds data: to replace live data, remove it first,
or restore into a second `TRAJ_HOME`. CSV and Markdown exports are for people; only the JSONL
restores.

`traj data remove` deletes `traj.db` and nothing else, so the launcher's `bin/` cache beside it
survives. It prints what would be lost, and it refuses unless `--confirm` names the data
directory's own path and `--backup` names a backup whose bytes are the data's, so a removal
cannot outrun the last write:

```bash
traj doctor --as-of 2026-11-30
traj backup --out ~/traj-backup-2026-11-30
traj data remove --confirm ~/.traj --backup ~/traj-backup-2026-11-30
```

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
registry in `src/registry.ts` with its exit class; add it to `RETRYABLE_CODES` there only when
retrying the same command can succeed. An input-validation sentence
comes from the shared table beside it, so a new command needs no wording of its
own. Commands never format output or
exit; `traj help <path>` and `traj schema <path>` are generated from the same
schemas that validate them. Test through `run(argv, io, env)`, which needs no
process. See ADR 0015.
