/*
 * The units and the closed value sets the published Scenario document states. They are the words a
 * person needs to write a document by hand, kept apart from the shapes that use them so a unit is
 * stated once (ADR-0009, #151).
 */

/** The unit of every money field: integer minor units, never the decimal string a result prints. */
export const MINOR_UNITS =
	"Integer minor units of `currency` (satang for THB): 35000 is 350.00 THB, and a Flow states it per occurrence, not per year."

/** The unit of every rate field. */
export const BASIS_POINTS =
	"Integer basis points (1 bps = 0.01%), so 3% is 300 and 0.01 is not a rate."

export const DATE = "YYYY-MM-DD, Gregorian, never the Buddhist calendar."

export const COMPOUNDING = ["monthly", "quarterly", "semiannual", "annual"] as const
export const FREQUENCIES = [
	"once",
	"daily",
	"weekly",
	"biweekly",
	"monthly",
	"quarterly",
	"annual",
] as const
export const DAY_RULES = ["exact", "next"] as const
/** The operations a Flow's own Measure graph may hold; `tally` belongs to a Levy (ADR-0032). */
export const DERIVE_MEASURE_OPS = [
	"const",
	"add",
	"sub",
	"min",
	"max",
	"scale",
	"mul",
	"pick",
	"flow",
] as const
