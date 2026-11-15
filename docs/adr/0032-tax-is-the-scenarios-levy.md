# Tax is the Scenario's Levy, and its Carry-in is the projection's

Tax enters a Projection as one `Levy` from `@trajectonomics/tax`, written into the stored Scenario by `traj scenario tax`, and the CLI holds no tax rule of its own: it turns `--tax th-2026`, `--filing-status`, `--children` and `--children-at-higher-rate` into the profile the core emits that Levy from, and refuses a Flow whose label the core would tally as nothing. A result reports `tax: applied` exactly when its Scenario holds the Levy, `not_applied` when it does not, and `mixed` for a `compare` whose two sides disagree.

The Scenario is the only place both halves can live. `sim-core` refuses a Flow that carries a Tally label with no Levy reading it (`LEVY_REQUIRED`), so a document labelled for tax cannot be stored without the Levy; and the CLI will not store a document it knows the engine rejects. The labels therefore arrive with the Levy, through `--label <flow>=<label>` on the same command, and are removed with it by `--none`.

The Carry-in goes the other way, because it depends on the As-of rather than the plan: it says what a Levy's period had already tallied and prepaid before the Projection starts, so the same stored Scenario projected from two dates needs two answers. `projection run`, `projection compare` and `fi` add it to this build's Levy only, and state in the notes what that assumes: a first tax year charged on part of the year, and a prior year's Settlement that is not recomputed. A Levy the CLI did not emit is left untouched, and the engine still refuses it when it needs a Carry-in.

## Considered options

Injecting the Levy at projection time was rejected by the engine, not by taste: the store validates a submitted document with `sim-core`'s `check()`, which refuses a labelled Flow with no Levy, so a caller could never store the labelled Scenario the projection would need. Requiring the user to hand-write the emitted Levy was rejected because the emitter is the core's, and a hand-copied measure graph is a second implementation. Echoing the taxpayer profile from each result was rejected because `sim-core`'s Scenario is strict and cannot hold it outside the measure graph; the stored document is the record, and its hash covers it.

## Consequences

`traj scenario apply` replaces the whole document, so re-applying a Scenario drops its Levy and labels: the caller runs `scenario tax` again. The CLI pins `@trajectonomics/tax` at an exact prerelease, because `emitThLevy` exists only in the `0.2.0-alpha.*` line while `0.1.0` stops at `calculateThTax`; the pin moves only on purpose and re-baselines the taxed projection test (ADR-0031 sets the precedent). A projection that starts mid-year is charged on the Flows inside it and says so, and any tax still owed from before the As-of belongs in the Ledger as a liability rather than in the projection.
