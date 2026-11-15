# Roadmap

Phases are ordered, not dated. Decisions behind them are in [`docs/adr/`](docs/adr/); terms are in [`GLOSSARY.md`](GLOSSARY.md).

## Phase 1: record, project, answer

`init`, accounts, `tx add/void/amend`, balances, reports, `inspect`/`export`, `schema`, scenarios, deterministic projection, `fi`, and Thai tax via tax-core — done, except an allowance optimizer and a stored taxpayer profile, which are Phase 3.

## Phase 2: richer input

Bulk `tx import` (single CSV template), history-derived baseline, liabilities and amortization, multiple goals.

## Phase 3: richer analysis

Seeded Monte Carlo, Thai allowance optimizer (RMF, SSF, ThaiESG), additional FI methods.

## Phase 4: budgeting

Budgeting on the same ledger.

## Phase 5: sync and beyond

Push/sync to a server and web; time management.

## Next steps, recorded but not scheduled

- **Multi-currency.** Unlock conditions: tax-core supports a non-THB jurisdiction; FX rates enter as explicit dated input and are never fetched; sim-core handles multi-currency accounts; the ledger gains conversion postings.
- **Real separate entities** (for example a company), using the reserved `entity` field.
- **MCP server**, once the command contract is stable.
- **HTML report** for human viewing.
