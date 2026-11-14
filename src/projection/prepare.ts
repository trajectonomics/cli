import type { Baseline, Scenario, Timeline } from "@trajectonomics/sim"
import { BASELINE_CURRENCY } from "../baseline/kind"
import { type AppError, isAppError } from "../errors"
import type { ScenarioDocument } from "../scenario/document"
import { scenarioNotFound } from "../scenario/errors"
import { applyScenarioSets } from "../scenario/set-apply"
import type { AppliedOverride } from "../scenario/set-error"
import type { Store } from "../store"
import { contentHash, supportedCurrency } from "../store"
import { canonicalJson } from "../store/canonical"
import { guard } from "../store/guard"
import type { ScenarioEcho } from "./view"

/** What every projection leaf resolves before it runs the engine. */
export type Prepared = {
	/**
	 * The stored document after the applied Overrides, as the engine's own type. The CLI keeps a
	 * Scenario as JSON and never models it (ADR-0024); the engine validates it again on the way in.
	 */
	document: Scenario
	overrides: AppliedOverride[]
	scenario: ScenarioEcho
	currency: string
	baseline: Baseline
	timeline: Timeline
}

/** The caller's side of one prepared Projection: which Scenario, from where, under which Sets. */
export type PrepareInput = {
	store: Store
	/**
	 * The Ledger's Baseline at `asOf`, mapped on first use. A compare maps it once for both sides,
	 * and a leaf that names a Scenario the store does not hold never maps it at all.
	 */
	baseline: () => Baseline | AppError
	/** The Scenario's name or id, as the caller typed it. */
	scenario: string
	/** The input field the name came from, so a miss names the flag or the positional. */
	scenarioPath: string
	asOf: string
	horizon: string
	sets: readonly string[]
}

/**
 * A Scenario whose currency is not THB cannot be projected against a THB Baseline (ADR-0005), so
 * it is refused here rather than after the engine runs. A currency that is not a string at all is
 * the engine's own `WRONG_TYPE`, not the CLI's: the document is passed through untouched.
 */
function thbOnly(document: ScenarioDocument): AppError | null {
	const currency = document["currency"]
	if (typeof currency !== "string") return null
	return supportedCurrency(currency, "scenario.currency")
}

/**
 * Resolves one Scenario by name or id, applies the `--set` Overrides transiently (ADR-0024),
 * maps the Ledger's Balances at `asOf` (ADR-0026) and builds the Timeline. It never writes, and
 * it reads nothing the caller did not state (ADR-0030): the store, the Ledger and the flags are
 * its whole input.
 */
export function prepareProjection(input: PrepareInput): Prepared | AppError {
	const row = input.store.getScenario(input.scenario)
	if (isAppError(row)) return row
	if (row === null) return scenarioNotFound(input.scenario, input.scenarioPath)
	const applied = applyScenarioSets(JSON.parse(row.document) as ScenarioDocument, input.sets)
	if (isAppError(applied)) return applied
	const unsupported = thbOnly(applied.document)
	if (unsupported !== null) return unsupported
	const mapped = input.baseline()
	if (isAppError(mapped)) return mapped
	// The effective hash is the stored hash function applied to the document after the Overrides.
	// Canonicalising cannot fail on a stored document plus JSON values, but `guard` makes a bug in
	// that assumption an envelope rather than a throw.
	const effective = guard(() => contentHash(canonicalJson(applied.document)))
	if (isAppError(effective)) return effective
	return {
		// The one place the stored JSON becomes the engine's type; `check()` reads it again.
		document: applied.document as unknown as Scenario,
		overrides: applied.overrides,
		scenario: {
			id: row.id,
			name: row.name,
			contentHash: row.contentHash,
			effectiveContentHash: effective,
		},
		currency: BASELINE_CURRENCY,
		baseline: mapped,
		timeline: { start: input.asOf, horizon: input.horizon, resolution: "month" },
	}
}
