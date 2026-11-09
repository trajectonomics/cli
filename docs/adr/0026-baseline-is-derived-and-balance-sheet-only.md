# The Baseline is derived on demand, holds only balance-sheet Accounts, and refuses what it cannot state

A Baseline is built from the Ledger when it is needed and never stored, so it cannot go stale. Only asset and liability **leaf** Accounts cross: `netWorth` is assets minus liabilities and counts nothing else, Equity is the contra side of an Opening balance, and income and expense are flows whose run-rates belong to the Scenario. A header Account never appears, because the core's Balances query returns leaves only; an archived Account does, because an Archive keeps history (ADR-0016).

A liability is written as the positive amount owed, the only place a Ledger type changes a number. The Ledger signs every Balance raw — debit positive, credit negative — while the simulation expects the debt itself, so a loan arrives negative and leaves negated. Account ids pass through unchanged, so a Scenario declares the same ids the Ledger minted.

A zero Balance is dropped before the sign flip. The engine opens every Account a Scenario declares at zero, so an absent Balance changes no number, while a zero Balance for an Account the Scenario does not model fails the whole Projection as an undeclared Balance — carrying it would force every paid-off loan to be declared forever. Dropping the zero before negating also keeps `-0` out of the document.

A Balance with no representation refuses the whole Baseline at exit 3, under the engine's own rule name for a negative amount. An overdrawn asset and an overpaid loan are both negative once stated, and the engine's amount is non-negative. Dropping the Account would silently shrink net worth; clamping to zero would silently invent it. A Baseline that refuses is recoverable; one that quietly differs from the Ledger is not.

## Considered options

Storing the Baseline was rejected: it would be a second source of truth that can disagree with the Ledger, and deriving it is cheap. Carrying income, expense or equity Accounts was rejected because none of them is something owned or owed. Carrying zeros was rejected for the reason above. Clamping or skipping an unrepresentable Balance was rejected because both make the document disagree with the Ledger without saying so.

## Consequences

The mapping keeps the engine's document in integer minor units in process, and the Command renders it with the repo's money formatter, so the CLI's JSON carries decimal strings plus a currency (ADR-0009) and no integer minor unit reaches an agent's pipe. A golden Projection over a fixture Ledger is the contract test that keeps the two cores honest: a semantic change in either one, or in the mapping, fails there rather than in a user's plan. The simulation cannot yet express an overdraft or an overpaid loan; until it can, such a Ledger refuses to project, which is honest but is a dead end for a user who really is overdrawn.
