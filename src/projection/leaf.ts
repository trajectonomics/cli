import type { Baseline } from "@trajectonomics/sim"
import { baselineOf } from "../baseline/mapping"
import type { Context, Result } from "../command"
import { ok } from "../command"
import { checkedAsOf, unsupportedYear, unsupportedYearMessage } from "../date"
import { type AppError, fail, isAppError } from "../errors"
import { withStore } from "../with-store"
import type { Prepared } from "./prepare"
import { prepareProjection } from "./prepare"

/** Which Scenario one side of a projection reads, and the Overrides applied to it. */
export type ScenarioRequest = {
	scenario: string
	/** The input field the name came from: `scenario`, `a` or `b`. */
	scenarioPath: string
	sets: readonly string[]
}

/** The date flags every projection leaf takes: both are required and both come from the caller. */
export type DateFlags = { asOf: string; horizon: string }

/** Prepares one side, or fails with the reason the caller can act on. */
export type Prepare = (request: ScenarioRequest) => Prepared | AppError

/**
 * The one body every projection leaf shares: check the As-of before the store opens (ADR-0029),
 * read the Ledger once, then let the leaf prepare one or two Scenarios against it. It keeps the
 * leaves to their own flags and their own result, and the store open, the Ledger read and the
 * Baseline mapping in one place.
 */
export function withProjection<T>(
	input: DateFlags,
	ctx: Context,
	work: (prepare: Prepare) => T | AppError,
): Result<T> | AppError {
	// The Horizon is the engine's Timeline, so a year outside the range is invalid input at its
	// flag rather than the Ledger's INVALID_DATE (ADR-0030, ADR-0036).
	const horizonYear = unsupportedYear(input.horizon)
	if (horizonYear !== undefined) {
		return fail("invalid_input", {
			path: "horizon",
			message: unsupportedYearMessage(horizonYear),
		})
	}
	const asOf = checkedAsOf(input.asOf)
	if (isAppError(asOf)) return asOf
	return withStore(ctx, (store) => {
		const ledger = store.ledger()
		if (isAppError(ledger)) return ledger
		// Mapped on first use, so a compare runs the mapping once and an unknown Scenario never does.
		let mapped: Baseline | AppError | undefined
		const baseline = (): Baseline | AppError => {
			if (mapped === undefined) {
				const mapping = baselineOf(ledger, input.asOf)
				mapped = isAppError(mapping) ? mapping : mapping.document
			}
			return mapped
		}
		const prepare: Prepare = (request) =>
			prepareProjection({
				store,
				baseline,
				scenario: request.scenario,
				scenarioPath: request.scenarioPath,
				asOf: input.asOf,
				horizon: input.horizon,
				sets: request.sets,
			})
		const outcome = work(prepare)
		return isAppError(outcome) ? outcome : ok(outcome)
	})
}
