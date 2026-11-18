import { DATE, DAY_RULES } from "./terms"

/** The Scenario's Calendar, with the day rule and the closed days it lists. */
export const calendarShape: Record<string, unknown> = {
	type: "object",
	description:
		"The Scenario's Calendar: how due dates move onto a working day, and which days are closed.",
	properties: {
		dayRule: {
			enum: [...DAY_RULES],
			description: "`exact` keeps a due date; `next` moves it forward to a working day.",
		},
		holidays: {
			type: "array",
			items: { type: "string" },
			description: `The closed days, each as ${DATE} A day listed twice is refused.`,
		},
	},
	required: ["dayRule", "holidays"],
	additionalProperties: false,
}
