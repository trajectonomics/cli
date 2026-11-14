import { z } from "zod"
import { dateField, moneyField } from "./money"
import { type RunsOutView, runsOut } from "./view"

/** The deterministic bindings a survival answer reports when FI is unreachable. */
export type SurvivalBinding =
	| "shortfallBeforeStop"
	| "undrawableMoney"
	| "insufficientMoney"
	| "minimumBuffer"

export const SURVIVAL_BINDINGS: readonly [SurvivalBinding, ...SurvivalBinding[]] = [
	"shortfallBeforeStop",
	"undrawableMoney",
	"insufficientMoney",
	"minimumBuffer",
]

/** The 25x rule of thumb beside a reachable FI date; it is a reference and never decides. */
export type RuleOfThumbView = {
	label: "ruleOfThumb"
	date: string
	multiplier: number
	basis: "unlockedAssets" | "allAssets" | "accessibleNetWorth" | "netWorth"
	window: "next12Months" | "trailing12Months"
	terms: "nominal" | "real"
	unlockedAssets: string
	numerator: string
	annualExpenses: string
	threshold: string
	multipleBps: number | null
	partial: boolean
	met: boolean
}

/** The best case the engine found, with either its run-out or its buffer breach. */
export type BestCaseView =
	| { month: string; runsOut: RunsOutView }
	| { month: string; bufferBreach: { date: string; required: string; accessible: string } }

export const ruleOfThumb: z.ZodType<RuleOfThumbView> = z.strictObject({
	label: z.literal("ruleOfThumb").describe("A reference figure, never a decision about FI."),
	date: dateField("The month the reference is measured at"),
	multiplier: z.number().describe("The multiple of annual expenses the reference divides by."),
	basis: z
		.enum(["unlockedAssets", "allAssets", "accessibleNetWorth", "netWorth"])
		.describe("Which balance is the reference's numerator."),
	window: z
		.enum(["next12Months", "trailing12Months"])
		.describe("Which twelve months of expenses the reference divides."),
	terms: z.enum(["nominal", "real"]).describe("Whether the reference is nominal or real money."),
	unlockedAssets: moneyField("Assets that are not locked"),
	numerator: moneyField("The balance the reference compares"),
	annualExpenses: moneyField("Annual expenses the reference measures against"),
	threshold: moneyField("The balance the reference asks for"),
	multipleBps: z
		.number()
		.int()
		.nullable()
		.describe("The numerator over annual expenses, in basis points; null when not statable."),
	partial: z.boolean().describe("True when the window holds less than twelve months."),
	met: z.boolean().describe("True when the numerator reaches the threshold."),
})

export const bestCase: z.ZodType<BestCaseView> = z.union([
	z.strictObject({
		month: dateField("The best-case month"),
		runsOut: runsOut.describe("The run-out that month would end in."),
	}),
	z.strictObject({
		month: dateField("The best-case month"),
		bufferBreach: z
			.strictObject({
				date: dateField("The month the buffer falls short"),
				required: moneyField("The buffer the answer asks for"),
				accessible: moneyField("Accessible net worth that month"),
			})
			.describe("The buffer shortfall that keeps this month from passing."),
	}),
])
