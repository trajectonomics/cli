import { SIM_PACKAGE, SIM_VERSION } from "./engine"
import type { Prepared } from "./prepare"
import type { Echo } from "./view"

/** The echo block every projection result carries (ADR-0030). */
export function echoOf(prepared: Prepared): Echo {
	return {
		asOf: prepared.timeline.start,
		engine: { package: SIM_PACKAGE, version: SIM_VERSION },
		scenario: prepared.scenario,
		overrides: prepared.overrides,
		tax: prepared.tax,
		notes: prepared.notes,
	}
}
