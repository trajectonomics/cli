import { MINOR_UNITS } from "./terms"

/** Where the Scenario's money goes, with the unit of every number it states. */
export const cashflowShape: Record<string, unknown> = {
	type: "object",
	description:
		"Where the scenario's money goes: what is left after spending, what funds each asset, and what pays for withdrawals.",
	properties: {
		surplus: {
			type: "array",
			description:
				"What is left after the month's income and spending, routed in order. It needs at least one step.",
			items: {
				type: "object",
				properties: {
					account: { type: "string", description: "An asset Account this document declares." },
					upTo: {
						type: "integer",
						description: `${MINOR_UNITS} Fill the Account up to this much, then move to the next step; a capped step needs one after it.`,
					},
				},
				required: ["account"],
				additionalProperties: false,
			},
		},
		contribute: {
			type: "array",
			items: { type: "string" },
			description:
				"The funding priority for asset Contributions: every asset a contribution Flow targets must appear here, and an extra entry is inert. A liability target is not listed: its Flow is the debt payment.",
		},
		withdraw: {
			type: "array",
			items: { type: "string" },
			description: "The ordered sources a withdrawal draws on; a locked Account is skipped.",
		},
	},
	required: ["surplus", "contribute", "withdraw"],
	additionalProperties: false,
}
