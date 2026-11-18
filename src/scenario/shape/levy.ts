/** A recurring date without a year, as the Levy's period and its settlement both state one. */
const monthDay = {
	type: "object",
	properties: {
		month: { type: "integer", description: "1 to 12." },
		day: {
			type: "integer",
			description: "A day that exists in that month, and never 29 February.",
		},
	},
	required: ["month", "day"],
	additionalProperties: false,
}

/** One Tax Levy, which `traj scenario tax` writes rather than a person (ADR-0032). */
export const levyShape: Record<string, unknown> = {
	type: "object",
	description:
		"One Tax Levy: a jurisdiction's rule set for one income tax, which `traj scenario tax` writes (ADR-0032). Its `measures` graph and `due` Measure carry the jurisdiction's own meaning, so read them off a Scenario that `traj scenario tax` wrote rather than hand-writing one.",
	properties: {
		id: {
			type: "string",
			description: "The Levy's id, which a Flow's `label` and `--carry-in` name.",
		},
		period: {
			...monthDay,
			description: "The first day of each Settlement period it tallies, as a month and a day.",
		},
		settlement: {
			...monthDay,
			description: "The day the period's tax is due: the first such date after the period ends.",
		},
		measures: {
			type: "array",
			description: "The Levy's Measure graph, whose ids are local to the Levy.",
			items: {
				type: "object",
				description: "One Measure; see a Flow's `derive` for the operations.",
			},
		},
		due: {
			type: "string",
			description: "The id of the Measure that is the amount owed before prepayment.",
		},
		carryIn: {
			type: "array",
			description:
				"Tallies a period that began before the Projection's start had already recorded, which `--carry-in` places at projection time; a stored document leaves it out.",
			items: { type: "object" },
		},
	},
	required: ["id", "period", "settlement", "measures", "due"],
	additionalProperties: false,
}
