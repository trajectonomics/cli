# A backup is the one file a restore reads, and removing the data needs a matching one

`traj backup --out DIR` writes `traj.jsonl`, the canonical JSONL dump, and `traj restore <DIR>`
reads it back into an empty database. `traj data remove` deletes that database's files and
nothing else, and only when a backup holds exactly the bytes it is about to delete.
`traj doctor` reports the state of all three. These are one decision because each exists only
to make the others safe: a backup nothing reads is not a backup, and a removal no backup guards
is the `rm -rf ~/.traj` that destroyed a ledger.

**Backup is the export, named for what it is for.** `backup` and `export --format jsonl` call
the same writer (`writeDumpExport`) and produce byte-identical files into a directory that must
not exist yet, so the two can never disagree about the format (ADR-0017, ADR-0028). It is a separate command because the name is
what an agent and a person look for, and because `export` also writes formats that do not
restore: a caller who backs up with `--format csv` has no backup at all. `backup` therefore has
no `--format`, and a file it cannot restore cannot be produced.

**Restore refuses a database that holds data.** `restore_target_not_empty` at exit 5, never a
merge and never an overwrite: a restore writes rows verbatim and every reference must land, so
there is no sensible meaning for "restore on top of". Replacing live data is two deliberate
commands, `traj data remove` and then `traj restore`, or a second `TRAJ_HOME` (ADR-0014).

**The removal guard is byte equality, not a timestamp.** `data remove --backup DIR` compares
the named backup's bytes with the canonical dump of the data as it stands now, and refuses with
`backup_stale` (exit 3) when they differ. The issue allowed "a backup newer than the last
write, or say so loudly"; equality is the stricter, clock-free form of the same rule. A file
mtime answers when a copy was last written rather than what it holds, so a backup taken after a
write and before another write would pass a timestamp test while losing the second write; and a
clock is one more thing a command would have to invent (ADR-0018, ADR-0029). Equality also
costs no new state: two dumps of one database are already byte-identical (ADR-0028), and a
stale backup is trivially fixed by running `traj backup` again.

**The confirmation is a path, and the refusal is the report.** `--confirm` must be the data
directory's own path. A run without it, or with another path, prints what one removal would
lose (`4 transactions, 8 postings, 7 accounts and 3 scenarios in /home/you/.traj`) in the
error's `message`, because the human Format renders `message` and `hint` and not `details`;
the same numbers travel in `details.rows` for a JSON caller. A typed path cannot be
mis-clicked, and a refusal that states the loss is also the answer to "what is in there".

**Only the database's files go.** The removal deletes `traj.db-shm`, `traj.db-wal` and
`traj.db`, in that order, and leaves the data directory, the launcher's `bin/` cache and
anything else in it (ADR-0014). The database goes last, so a removal that fails part way has not
removed what holds the data. The result lists the files removed and what remains beside them.

**Doctor reports; it does not fail.** `ok` is false when a check failed, and the process still
exits 0, because a damaged ledger is the answer to the question a caller asked, not an error in
asking it. It writes no row of its own: opening an older database migrates it like every command
(ADR-0014), and that is the only write a doctor can cause. Each check carries its own
one-sentence verdict, so a caller reads what is wrong without parsing a code. Two checks are
separate on purpose: `integrity` is SQLite's own `PRAGMA integrity_check` over the pages, and
`ledger` is the ledger core re-validating every stored Transaction, which is how a tampered
Posting surfaces as `UNBALANCED_TRANSACTION`. The trial balance needs a date and is therefore
opt-in (`--as-of`, ADR-0029); without one the check is `skipped` with the sentence saying so, not
a silent pass. A bad `--as-of` is the caller's input and is raised as `INVALID_DATE`, like
`balance`. Doctor opens no database that does not exist and creates no directory: a diagnostic
must not create what it diagnoses.

**The name is `data remove`.** ADR-0016 gives the ledger's three deletion stories their own
names (void, archive, tombstone) and this is not a fourth: nothing in the ledger is deleted, so
no ledger command can reach it. It names its object, the data, which keeps it apart from
`tx void`, `account close` and `scenario rm`; the `data` group leaves room for a future
`data path` or `data backup`, and `purge`, `reset`, `wipe` and `delete` all read as "make my
ledger consistent again", which is exactly what this command must never claim to do.

## Considered options

Merging restore into `tx import` was rejected: the canonical dump is not the import template
(ADR-0025), `import` writes ledger facts through the write path while a restore writes rows
verbatim, and `restore` must be able to start a database that has nothing in it.

`restore --force` over live data was rejected as the unsafe default. It is one flag away from a
second `TRAJ_HOME` and it puts "overwrite my ledger" inside the command whose name means
"bring it back".

Checking a backup's mtime instead of its bytes was rejected above. Requiring the backup to be
in the data directory, or writing a manifest beside it, was rejected: the file already carries
the format and schema versions in its header, and a second file is a second thing to lose.

`doctor` failing at the first broken check was rejected: the caller asked what is wrong, and
one exit code would hide the other five answers. Deleting a whole data directory was rejected
because that is the failure this command exists to prevent.

## Consequences

A backup is only as good as the bytes it holds, so a data directory whose database will not
open cannot be removed by `data remove`: the guard cannot be evaluated, and the tool never
removes what it cannot read. Recovery from a corrupt database is the operator's `mv` of
`traj.db` out of the way, then `traj restore`.

Two CLI-owned codes join the registry with a trigger in the contract test: `backup_unreadable`
at exit 1 and `backup_stale` at exit 3, beside `restore_target_not_empty` at exit 5, which the
store raises. None of the three is retryable: the same command cannot succeed until the caller
takes a fresh backup, restores somewhere else, or fixes the file it named (ADR-0037). `doctor`'s checks are prose in a Result, so a new check is a new entry in its
output schema and no new code.

The README section that names these four commands carries the release marker
`> **Ships in 0.3.0.**` until that release is on npm (ADR-0034).
