import type { Placed } from "./carryin-apply"
import { SIM_PACKAGE, SIM_VERSION } from "./engine"
import type { Echo } from "./view"

/** The echo block every projection result carries (ADR-0030). */
export function echoOf(prepared: Placed): Echo {
	return {
		asOf: prepared.timeline.start,
		engine: { package: SIM_PACKAGE, version: SIM_VERSION },
		scenario: prepared.scenario,
		overrides: prepared.overrides,
		tax: prepared.tax,
		...(prepared.carryIn.length === 0 ? {} : { carryIn: prepared.carryIn }),
		notes: prepared.notes,
	}
}
