import type { Baseline, Timeline } from "@trajectonomics/sim"
import { baselineOf } from "../baseline/mapping"
import { type AppError, fail, isAppError } from "../errors"
import type { ScenarioDocument } from "../scenario/document"
import { scenarioNotFound } from "../scenario/errors"
import { applyScenarioSets } from "../scenario/set-apply"
import type { AppliedOverride } from "../scenario/set-error"
import type { Ledger, Store } from "../store"
import { contentHash, supportedCurrency } from "../store"
import { canonicalJson } from "../store/canonical"
import { guard } from "../store/guard"
import type { ScenarioEcho } from "./view"

/** What every projection leaf resolves before it runs the engine. */
export type Prepared = {
	/** The stored document after the applied Overrides, exactly as the engine will read it. */
	document: ScenarioDocument
	overrides: AppliedOverride[]
	scenario: ScenarioEcho
	currency: string
	baseline: Baseline
	timeline: Timeline
}

/** The caller's side of one prepared Projection: which Scenario, from where, under which Sets. */
export type PrepareInput = {
	store: Store
	ledger: Ledger
	/** The Scenario's name or id, as the caller typed it. */
	scenario: string
	/** The input field the name came from, so a miss names the flag or the positional. */
	scenarioPath: string
	asOf: string
	horizon: string
	sets: readonly string[]
}

/**
 * A Scenario whose currency is not THB cannot be projected against a THB Baseline (ADR-0005).
 * A document that is not v1 THB stops here rather than at the engine, because the currency is
 * the one field the Baseline cannot answer.
 */
function currencyOf(document: ScenarioDocument): string | AppError {
	const currency = document["currency"]
	if (typeof currency !== "string") {
		return fail("projection_refused", {
			path: "scenario.currency",
			message: "scenario.currency: WRONG_TYPE",
			details: [{ code: "WRONG_TYPE", path: "scenario.currency" }],
		})
	}
	const unsupported = supportedCurrency(currency, "scenario.currency")
	if (unsupported !== null) return unsupported
	return currency
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
	const currency = currencyOf(applied.document)
	if (isAppError(currency)) return currency
	const mapping = baselineOf(input.ledger, input.asOf)
	if (isAppError(mapping)) return mapping
	// The effective hash is the stored hash function applied to the document after the Overrides.
	// Canonicalising cannot fail on a stored document plus JSON values, but `guard` makes a bug in
	// that assumption an envelope rather than a throw.
	const effective = guard(() => contentHash(canonicalJson(applied.document)))
	if (isAppError(effective)) return effective
	return {
		document: applied.document,
		overrides: applied.overrides,
		scenario: {
			id: row.id,
			name: row.name,
			contentHash: row.contentHash,
			effectiveContentHash: effective,
		},
		currency,
		baseline: mapping.document,
		timeline: { start: input.asOf, horizon: input.horizon, resolution: "month" },
	}
}
