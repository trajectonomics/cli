# Date ranges are `--since` and `--until`; `--from` and `--to` are accounts

ADR-0005 fixes `--from`/`--to` as the two sides of a transaction's simple surface, while #7 asks for `report pnl|networth [--from --to]` as a date range. Flags are scoped per leaf, so the parser never meets both meanings at once; a reader does, and "from" would name an account on one command and a date on another. Reserving the pair costs nothing while nothing is implemented and #7 is still a body, and costs a breaking rename later. So: `--since` and `--until`, both inclusive, are the only date-range flags; `--from` and `--to` never carry a date.

## Considered options

`--after`/`--before` were rejected because they read as exclusive, which they would not be. `--start`/`--end` were rejected because "end" does not say whether the end day is included — the one thing a date range must be unambiguous about. `--date-from`/`--date-to` were rejected as noise that still teaches the wrong word.

## Consequences

#7's body changes to `--since`/`--until`, and so does anything else that later asks for a period. A leaf that genuinely needs an account pair and a date range would otherwise have had two `--from`s, which the surface can no longer express.
