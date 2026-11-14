# The `sim-core` pin is an exact prerelease until its stable release has FI

`@trajectonomics/sim` `0.1.0` has `project` and `check` but no `financialIndependence`; FI exists only in the `0.2.0-alpha.*` line. AGENTS.md rule 5 forbids reimplementing it here, so the CLI pins an exact prerelease, as it already pins `@trajectonomics/ledger` at `0.1.0-alpha.0`, and moves to the stable `0.2.0` when `sim-core` releases it. The pin moves only on purpose, never by range, and a move re-baselines the contract goldens (ADR-0026).

The prerelease reads Scenario `schemaVersion: 4`, which needs a `cashflow.contribute` key that version 1 documents lack. Stored version 1 Scenarios are not migrated: the CLI would otherwise own a second Scenario model (ADR-0024). The engine refuses them with `UNSUPPORTED_SCHEMA_VERSION`, a projection reports `projection_refused`, `scenario show` still prints them, and `scenario apply` of an edited document replaces them. A restore of an older document fails at its document path with the engine's code, which ADR-0024 already anticipates.

## Considered options

Waiting for a stable release was rejected: it blocks `fi` on an owner-run release with no date. Migrating stored rows in the CLI was rejected for the reason above and because it would rewrite stored bytes and hashes silently. Shipping `projection run` on `0.1.0` and `fi` later was rejected: `compare` needs the FI date, and a second pin bump would repeat the golden rewrite.

## Consequences

The CLI depends on a prerelease of a shared package; `sim-core` must keep publishing the exact version or this pin breaks installs. Fixtures and goldens are Scenario v4.
