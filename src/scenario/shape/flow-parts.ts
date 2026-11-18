import { BASIS_POINTS, DERIVE_MEASURE_OPS } from "./terms"

/*
 * The three parts of a Flow whose keys are not simply a name and a unit: the two shapes a Levy reads
 * a share of each occurrence from, and the Measure graph a derived amount is computed by. They live
 * here so `flow.ts` stays one screen long, and every one of them states its `Needs a Levy` rule.
 */

/** Income only: shares of each occurrence taken at source, one per Levy. */
export const prepaymentsShape: Record<string, unknown> = {
	type: "array",
	description:
		"Income only: shares of each occurrence taken at source, one per Levy. Needs a Levy.",
	items: {
		type: "object",
		properties: {
			levy: { type: "string", description: "The Levy's id, as the Scenario spells it." },
			bps: { type: "integer", description: `${BASIS_POINTS} Share of the gross taken at source.` },
		},
		required: ["levy", "bps"],
		additionalProperties: false,
	},
}

/** Income only: a second share taken at source, capped by a `const` Measure of the Levy. */
export const cappedPrepaymentShape: Record<string, unknown> = {
	type: "object",
	description:
		"Income only: a second share taken at source, capped by a Measure of the Levy. Needs a Levy.",
	properties: {
		levy: { type: "string", description: "The Levy's id, as the Scenario spells it." },
		bps: { type: "integer", description: `${BASIS_POINTS} Share of the gross taken at source.` },
		upTo: {
			type: "string",
			description: "The id of a `const` Measure of that Levy that caps the share.",
		},
	},
	required: ["levy", "bps", "upTo"],
	additionalProperties: false,
}

/** One Measure of a Flow's graph; the keys after `op` belong to that operation. */
const measureShape = {
	type: "object",
	description:
		"One Measure: `const` reads `value` (with `asOf` and `growth`, or `steps`), `add`/`sub`/`min`/`max` read `a` and `b`, `scale` reads `of`, `num`, `den` and `rounding`, `mul` reads `a`, `b`, `den` and `rounding`, `pick` reads `a`, `b`, `then` and `else`, and `flow` reads another Flow's landed amount. A `tally` Measure belongs to a Levy, not to a Flow.",
	properties: {
		id: { type: "string", description: "The Measure's id, local to this graph." },
		op: {
			enum: [...DERIVE_MEASURE_OPS],
			description:
				"Which operation it is. A `tally` Measure belongs to a Levy, so it is not one of these.",
		},
	},
	required: ["id", "op"],
}

/** An amount computed per occurrence from a Measure graph, in place of `amount` and `growth`. */
export const deriveShape: Record<string, unknown> = {
	type: "object",
	description:
		"An amount computed per occurrence from a Measure graph, in place of `amount` and `growth`.",
	properties: {
		measures: {
			type: "array",
			description: "The graph, whose Measure ids are local to this Flow.",
			items: measureShape,
		},
		result: {
			type: "string",
			description: "The id of the Measure that is this Flow's amount.",
		},
	},
	required: ["measures", "result"],
	additionalProperties: false,
}
