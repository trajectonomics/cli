import { z } from "zod"
import { dateField } from "./money"
import {
	type BestCaseView,
	bestCase,
	type RuleOfThumbView,
	ruleOfThumb,
	SURVIVAL_BINDINGS,
	type SurvivalBinding,
} from "./reference-view"
import {
	asOfField,
	type Echo,
	engineEcho,
	notesField,
	overridesField,
	scenarioEcho,
	taxField,
} from "./view"

export type {
	BestCaseView,
	RuleOfThumbView,
	SurvivalBinding,
} from "./reference-view"

/** The survival answer, in the engine's own three shapes (ADR-0008). */
export type FiAnswer =
	| { reachable: true; fiDate: string; reference: RuleOfThumbView }
	| { reachable: false; binding: "noCandidateMonth" }
	| { reachable: false; binding: SurvivalBinding; bestCase: BestCaseView }

/** `traj fi`: the survival answer plus the echo block (ADR-0030). */
export type FiView = Echo & {
	horizon: string
	currency: string
	method: "survival"
	definition: { method: "survival"; definitionVersion: number }
	fi: FiAnswer
}

export const fiAnswer: z.ZodType<FiAnswer> = z.union([
	z.strictObject({
		reachable: z.literal(true),
		fiDate: dateField("The earliest month earned income could stop"),
		reference: ruleOfThumb.describe(
			"The rule-of-thumb reference beside the date; it never decides.",
		),
	}),
	z.strictObject({
		reachable: z.literal(false),
		binding: z
			.literal("noCandidateMonth")
			.describe("The horizon leaves no month a stop could start from."),
	}),
	z.strictObject({
		reachable: z.literal(false),
		binding: z.enum(SURVIVAL_BINDINGS).describe("The constraint that keeps FI out of reach."),
		bestCase: bestCase.describe("The best month the engine found, and why it fails."),
	}),
])

export const fiView: z.ZodType<FiView> = z.strictObject({
	asOf: asOfField,
	engine: engineEcho,
	scenario: scenarioEcho,
	overrides: overridesField,
	tax: taxField,
	notes: notesField,
	horizon: dateField("The date the Projection ends at"),
	currency: z.string().describe("The Scenario's ISO 4217 currency; v1 is THB only."),
	method: z.literal("survival").describe("The FI method, as the engine states it."),
	definition: z.strictObject({
		method: z.literal("survival").describe("The FI method; ADR-0008 fixes survival."),
		definitionVersion: z.number().int().describe("The engine's version of that definition."),
	}),
	fi: fiAnswer,
})
