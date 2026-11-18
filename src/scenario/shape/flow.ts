import { labelSetsSentence } from "../tax/labels"
import { cappedPrepaymentShape, deriveShape, prepaymentsShape } from "./flow-parts"
import { BASIS_POINTS, DATE, FREQUENCIES, MINOR_UNITS } from "./terms"

/** One Stream, Event or Contribution, with the unit of every number it states. */
export const flowShape: Record<string, unknown> = {
	type: "object",
	description:
		"One Stream, Event or Contribution. `earned` is required on an income Flow and `target` on a contribution Flow; `label`, `prepayments` and `cappedPrepayment` apply to the kinds they name; and exactly one of `amount` and `derive` is required, the first bringing `growth` with it.",
	properties: {
		id: {
			type: "string",
			description: "The name this document gives the Flow, unique within it and never changed.",
		},
		kind: {
			enum: ["income", "expense", "contribution"],
			description:
				"`income` earns, `expense` spends, and `contribution` moves money into the Account its `target` names.",
		},
		frequency: {
			enum: [...FREQUENCIES],
			description:
				"How often it lands. A `once` Flow lands on `start` alone, so its `end` may only repeat `start`.",
		},
		start: { type: "string", description: `The first date it can land, as ${DATE}` },
		end: {
			type: "string",
			description: `The last date it can land, as ${DATE} Omit it and the Flow runs to the horizon.`,
		},
		amount: {
			type: "integer",
			description: `${MINOR_UNITS} The same figure every occurrence, grown from \`start\` by \`growth\`. Required unless the Flow states \`derive\`.`,
		},
		growth: {
			anyOf: [
				{ const: "inflation", description: "Follow `economy.inflation`." },
				{
					type: "object",
					properties: {
						bps: {
							type: "integer",
							description: `${BASIS_POINTS} Per year; negative steps it down.`,
						},
					},
					required: ["bps"],
					additionalProperties: false,
				},
			],
			description:
				'The yearly step applied to `amount` from `start`. Required wherever `amount` is stated, a `once` Flow included, where `{ "bps": 0 }` means no step; a Flow that states `derive` forbids it.',
		},
		earned: {
			type: "boolean",
			description:
				"Income only. `true` stops when earning stops, so the FI date depends on it; `false` continues.",
		},
		label: {
			type: "string",
			description: `Income and contribution only: the Tally label a Levy sums this Flow under, written by \`traj scenario tax --label\`. A Flow without one is not tax-free, it is income no Levy is told about. ${labelSetsSentence()} Needs a Levy.`,
		},
		prepayments: prepaymentsShape,
		cappedPrepayment: cappedPrepaymentShape,
		target: {
			type: "string",
			description:
				"Contribution only: the Account the money moves into. A liability target is a debt payment, capped at the amount owed; an asset target is funded from `cashflow.contribute`.",
		},
		derive: {
			...deriveShape,
			description: `${deriveShape["description"]} Required unless the Flow states \`amount\`, which it replaces along with \`growth\`.`,
		},
	},
	required: ["id", "kind", "frequency", "start"],
	additionalProperties: false,
}
