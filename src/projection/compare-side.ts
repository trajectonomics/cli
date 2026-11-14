import { z } from "zod"
import { ageFigures } from "./ages-view"
import { type FiAnswer, fiAnswer } from "./fi-view"
import { dateField, moneyField } from "./money"
import {
	type OverrideEcho,
	overrideEcho,
	type RunsOutView,
	runsOut,
	type ScenarioEcho,
	scenarioEcho,
} from "./view"

/** One side of a `projection compare`: its own answer, its net worth figures and its run-out. */
export type CompareSide = {
	scenario: ScenarioEcho
	overrides: OverrideEcho[]
	fi: FiAnswer
	runOut: RunsOutView | null
	netWorth: {
		final: { date: string; nominal: string; real: string }
		atAges: { age: number; nominal: string | null; real: string | null }[]
	}
}

export const compareSide: z.ZodType<CompareSide> = z.strictObject({
	scenario: scenarioEcho,
	overrides: z.array(overrideEcho).describe("The applied overrides for this side, in order."),
	fi: fiAnswer.describe("This side's own FI answer."),
	runOut: runsOut.nullable().describe("The month this side runs out of money, or null."),
	netWorth: z.strictObject({
		final: z.strictObject({
			date: dateField("The Projection's last row: the horizon, or the run-out month"),
			nominal: moneyField("Net worth at the Projection's end"),
			real: moneyField("The same figure in start-of-timeline terms"),
		}),
		atAges: ageFigures("Net worth at that age"),
	}),
})
