# trajectonomics

A command line for managing personal resources, money first. It records what actually happened, derives a starting point from it, and projects the future under stated assumptions.

## Language

### Layers

**Ledger**:
The append-only record of what actually happened to money: accounts, transactions, and their postings.
_Avoid_: Books, journal

**Baseline**:
The starting state of a projection, derived from the ledger or written by hand: current balances and income and spending run-rates.
_Avoid_: Snapshot, current state

**Scenario**:
A named set of assumptions about the future: economy, accounts, streams, events, cash flow rules, and the FI goal.
_Avoid_: Forecast, model

**Projection**:
The month-by-month result of running a baseline through a scenario. The same baseline and scenario always give the same projection.
_Avoid_: Run, output

**As-of**:
The date a baseline or projection is evaluated at. Every result states it.
_Avoid_: Today, now, snapshot date

### Ledger

**Account**:
A named place in the ledger where value sits or comes from, such as a bank account, an expense category, or an equity account.
_Avoid_: Wallet

**Transaction**:
One balanced, immutable record of money moving, made of two or more postings that sum to zero.
_Avoid_: Entry, payment

**Posting**:
A single signed amount against one account, carrying its currency and optional dimensions.
_Avoid_: Line, leg, split

**Void**:
A reversing transaction that cancels an earlier one. Nothing in the ledger is ever deleted.
_Avoid_: Delete, cancel, remove

**Amend**:
A void of an earlier transaction plus a linked replacement.
_Avoid_: Edit, update

**Archive**:
The state that `account close` produces: the account stops accepting postings and stays in history, reports and exports. Closing never deletes.
_Avoid_: Delete, remove

**Dimension**:
A tag on a posting that slices reports without changing any balance.
_Avoid_: Tag, label

**Project**:
A dimension that groups the postings of a side venture so it can be reported like a small business.
_Avoid_: Business

**Entity**:
A legally separate party whose books balance on their own. Only the personal entity exists today.
_Avoid_: Company, tenant

**Personal entity**:
The one seeded entity that owns every account and scenario today. It is addressed by a fixed id, never by the core's `"default"` fallback.
_Avoid_: Default entity, main entity

### Scenario

**Stream**:
A recurring flow of money in a scenario, either earned (stops when earning stops) or passive (continues).
_Avoid_: Income source

**Event**:
A dated one-off change in a scenario, such as a purchase or a windfall.
_Avoid_: Milestone

**Contribution**:
Money moved from cash flow into an investment or retirement account. It is not an expense, so net worth does not change at that instant.
_Avoid_: Investment expense, savings

### Financial independence

**FI**:
Financial independence: the point from which the portfolio and passive streams can fund the planned life without earned income.
_Avoid_: FIRE

**Survival**:
The FI method that finds the earliest month at which, if earned income stopped, the projection never runs out of money before the horizon.
_Avoid_: Safe withdrawal, 25× rule

**Horizon**:
The age at which a projection ends.
_Avoid_: End date, lifespan

### Packages

**Core**:
A separate, pure package of real-world logic (ledger, simulation, or tax) that knows nothing about this application.
_Avoid_: Library, plugin

### Contract

**Exit code**:
The coarse class of a finished run: 0 ok, 1 unexpected, 2 invalid input, 3 domain rejection, 4 not found, 5 conflict.
_Avoid_: Status, return code

**Error code**:
The stable string name of one failure, belonging to exactly one exit code. Many error codes share one exit code; one error code never spans two.
_Avoid_: Error id, reason, cause

**Command**:
One runnable entry of the CLI, such as `tx add`, reached by a path of words. It validates its input, returns a Result and never formats or exits.
_Avoid_: Subcommand, action, verb

**Group**:
A command path prefix, such as `tx`, that only holds commands. A bare group prints its usage.
_Avoid_: Namespace, category

**Flag**:
A named option of a command, derived from a field of its input schema that is not a positional.
_Avoid_: Option, switch

**Format**:
How a command renders its result, `human` or `json`, chosen explicitly by flag or environment and never inferred from a terminal.
_Avoid_: Mode, output type

**Result**:
What a command returns when it succeeds, shaped by that command's output schema.
_Avoid_: Output, response, payload

**Data directory**:
The single directory holding all state, `~/.traj` unless `TRAJ_HOME` says otherwise.
_Avoid_: Home, config dir, state dir
