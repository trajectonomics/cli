import { accountShape } from "./account"
import { calendarShape } from "./calendar"
import { cashflowShape } from "./cashflow"
import { flowShape } from "./flow"
import { levyShape } from "./levy"
import { BASIS_POINTS } from "./terms"

export { scenarioShapeDescription } from "./description"
export { scenarioExample } from "./example"

/*
 * The Scenario document, as `traj schema scenario apply` publishes it (#151). The core owns the
 * model and its `check()` is the validator: nothing here validates, and a document is refused only
 * with the core's own codes. What the core cannot say for itself is written down once, in these
 * files: the shape of each key, the unit of each number, and the closed value sets. The tests
 * beside them prove every path, every enum value and the example against the pinned core, so a pin
 * bump that renames a key or drops a value fails in CI rather than in a person's first apply.
 */

/**
 * The document's properties, with `schemaVersion` pinned to the version the core accepts. The
 * version is an argument rather than an import so this module never asks the core itself, which
 * keeps one scan and one memo in `document.ts`.
 */
export function scenarioShapeProperties(version: number | undefined): Record<string, unknown> {
	return {
		schemaVersion:
			version === undefined
				? { type: "integer", description: "The Scenario version the pinned core accepts." }
				: { const: version, description: "The Scenario version the pinned core accepts." },
		currency: {
			type: "string",
			description:
				'The ISO 4217 code every amount is stated in. Only "THB" is supported in this version: another code applies, and the projection then refuses it.',
		},
		economy: {
			type: "object",
			description: "The assumptions that apply to the whole Scenario.",
			properties: {
				inflation: {
					type: "integer",
					description: `${BASIS_POINTS} Per year; negative is deflation.`,
				},
			},
			required: ["inflation"],
			additionalProperties: false,
		},
		accounts: {
			type: "array",
			description:
				"Every Account the Scenario assumes. The derived Baseline names its Accounts by id, so a projection needs the Ledger Account's id in the matching entry here.",
			items: accountShape,
		},
		flows: {
			type: "array",
			description: "The Streams, Events and Contributions the Scenario assumes.",
			items: flowShape,
		},
		cashflow: cashflowShape,
		levies: {
			type: "array",
			description:
				"The Tax Levies the Scenario is taxed under; a Scenario without one reports pre-tax figures.",
			items: levyShape,
		},
		calendar: calendarShape,
	}
}

/** The keys every document states, in the order the core's own type lists them. */
export const SCENARIO_SHAPE_REQUIRED: readonly string[] = [
	"schemaVersion",
	"currency",
	"economy",
	"accounts",
	"flows",
	"cashflow",
]
