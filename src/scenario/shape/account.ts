import { BASIS_POINTS, COMPOUNDING, DATE } from "./terms"

/** One Account the Scenario assumes, with the unit of every number it states. */
export const accountShape: Record<string, unknown> = {
	type: "object",
	description:
		"One Account the Scenario assumes. Every field but `id`, `kind` and `rate` is optional.",
	properties: {
		id: {
			type: "string",
			description:
				"The name this document gives the Account, unique within it. A projection against the derived Baseline needs the Ledger Account's id here.",
		},
		kind: {
			enum: ["asset", "liability"],
			description:
				"`asset` holds value and earns `rate`; `liability` is money owed, and its Balance is stated as the positive amount owed.",
		},
		rate: {
			type: "integer",
			description: `${BASIS_POINTS} Per year: an asset's expected return, or a liability's interest. It is the effective annual rate, or the nominal one when \`compounding\` is present.`,
		},
		compounding: {
			enum: [...COMPOUNDING],
			description:
				"The period at whose end accrued interest is capitalised, which makes `rate` nominal. Omit it for an effective yearly rate.",
		},
		lockedUntil: {
			type: "string",
			description: `Assets only, ${DATE} Value held in the Account does not count toward accessible net worth until then.`,
		},
		returnLabel: {
			type: "string",
			description:
				"Assets only: the Tally label the Account's accrued growth is reported under; omit to report none. Needs a Levy.",
		},
		gainLabel: {
			type: "string",
			description:
				"Assets only: the Tally label the Account's realised gains are reported under; omit to report none. Needs a Levy.",
		},
	},
	required: ["id", "kind", "rate"],
	additionalProperties: false,
}
