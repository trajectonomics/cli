# Read-only commands take their date from the caller, never from the clock

Every command that states a reading of the Ledger at a date takes that date as a required flag: `balance --as-of`, `report networth --as-of`, `report pnl --until` with `--since` optional. Nothing defaults from the clock and nothing derives a date from the data. ADR-0018 makes the same rule for commands that write; a read that says "today" is not reproducible, because the answer changes overnight while its arguments do not.

`--since` is the only optional date, and only because its absence has a meaning the core already owns: "from the start of the Ledger". An absent end would have to be invented.

## Considered options

Defaulting `--until` to the date of the latest posted Transaction was rejected. It is deterministic, but it derives the answer's boundary from the data rather than from the caller, and it is undefined on an empty Ledger — the one case where a report should be plainly empty rather than silently reinterpreted. Defaulting either end to the clock was rejected for the reason in ADR-0018: a laptop in Bangkok and a build server in UTC disagree about the date for seven hours of every day.

## Consequences

A human types the date or lets their shell supply it; an agent always has one. Every result echoes the As-of it was stated at, so a stored report can be read later without guessing its boundary. A caller who wants "as of now" spells it, which is what makes it their choice rather than the CLI's.
