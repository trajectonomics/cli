import { SIM_PACKAGE, SIM_VERSION } from "./engine"
import type { Prepared } from "./prepare"
import type { Echo, TaxStatus } from "./view"

/** The one sentence a person must read before the figures, so a pre-tax plan is not mistaken. */
export const NO_TAX: string = "No tax is applied; figures are before tax."

/** `tax` is `not_applied` until a tax core is wired in; every leaf echoes it (ADR-0030). */
export const TAX: TaxStatus = "not_applied"

/** The echo block every projection result carries (ADR-0030). */
export function echoOf(prepared: Prepared): Echo {
	return {
		asOf: prepared.timeline.start,
		engine: { package: SIM_PACKAGE, version: SIM_VERSION },
		scenario: prepared.scenario,
		overrides: prepared.overrides,
		tax: TAX,
		notes: [NO_TAX],
	}
}
