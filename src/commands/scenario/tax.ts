import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand } from "../../command"
import { FILING_STATUSES, labelFlagDescription, writeTax } from "../../scenario/tax"
import { writtenScenario } from "../../scenario/view"

export const tax: Leaf = defineCommand({
	name: "tax",
	summary: "Write or remove the tax Levy a Scenario's labelled Flows are taxed under",
	positionals: ["scenario"],
	input: z.strictObject({
		scenario: z.string().min(1).describe("The Scenario's exact name or its id."),
		tax: z
			.enum(["th-2026"])
			.optional()
			.describe("Write the tax Levy for this jurisdiction: `th-2026`, Thailand's 2026 income tax."),
		filingStatus: z
			.enum(FILING_STATUSES)
			.optional()
			.describe("The taxpayer's filing status; needs --tax and defaults to `single`."),
		children: z
			.number()
			.int()
			.min(0)
			.optional()
			.describe("Children counted for the child allowance; needs --tax and defaults to 0."),
		childrenAtHigherRate: z
			.number()
			.int()
			.min(0)
			.optional()
			.describe(
				"Children born 2018 or later, allowed at the higher rate; a subset of --children and needs --tax.",
			),
		label: z.array(z.string()).optional().describe(labelFlagDescription()),
		none: z.boolean().optional().describe("Remove the tax Levy instead of writing one."),
		dryRun: z.boolean().optional().describe("Report the row and roll the write back."),
	}),
	output: z.strictObject({
		dryRun: z.boolean().describe("True when the write was rolled back."),
		status: z
			.enum(["created", "updated", "unchanged"])
			.describe("Whether the document changed; `created` is never returned here."),
		scenario: writtenScenario,
	}),
	examples: [
		{
			command: "traj scenario tax base --tax th-2026 --label salary=income.section40_1",
			description: "Charge Thailand's 2026 income tax on the salary this Scenario declares.",
		},
		{
			command:
				"traj scenario tax base --tax th-2026 --filing-status married_joint --children 1 --label salary=income.section40_1",
			description: "The same Levy under a married-joint profile with one child.",
		},
		{
			command: "traj scenario tax base --none",
			description: "Take the tax Levy out, so the figures are pre-tax again.",
		},
	],
	errorCodes: ["database_busy", "invalid_input", "not_found"],
	run: (input, ctx) => writeTax(input, ctx),
})
