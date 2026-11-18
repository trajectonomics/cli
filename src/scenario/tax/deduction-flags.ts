import { z } from "zod"
import type { TaxAllowances } from "./allowances"

/** One deduction flag: an amount or count the caller states, never a required one. */
type DeductionFlag = z.ZodOptional<z.ZodNumber>

/** The deduction flags `scenario tax` accepts, one per allowance a caller can state. */
export type DeductionFlags = Record<keyof TaxAllowances, DeductionFlag>

/**
 * The deduction flags `scenario tax` accepts. Each states an amount the taxpayer paid in the tax
 * year; `@trajectonomics/tax` owns every statutory ceiling, so none is restated here. The fields
 * are spread into the command's input so one file holds their wording and their order.
 */
export const deductionFlags: DeductionFlags = {
	parents: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe(
			"Parents aged 60 or over with income of at most 30,000 THB whom the taxpayer supports; needs --tax.",
		),
	disabledCare: z
		.number()
		.int()
		.min(0)
		.optional()
		.describe("Relatives with a disability the taxpayer cares for; needs --tax."),
	socialSecurity: z
		.number()
		.min(0)
		.optional()
		.describe("Social security contributions paid in the tax year, in THB; needs --tax."),
	lifeInsurance: z
		.number()
		.min(0)
		.optional()
		.describe("Life insurance premiums paid in the tax year, in THB; needs --tax."),
	healthInsurance: z
		.number()
		.min(0)
		.optional()
		.describe("The taxpayer's own health insurance premiums, in THB; needs --tax."),
	parentHealthInsurance: z
		.number()
		.min(0)
		.optional()
		.describe("Health insurance premiums paid for the taxpayer's parents, in THB; needs --tax."),
	spouseLifeInsurance: z
		.number()
		.min(0)
		.optional()
		.describe(
			"Life insurance premiums paid for a spouse with no income, in THB; needs --tax and a filing status that allows the spouse allowance.",
		),
	mortgageInterest: z
		.number()
		.min(0)
		.optional()
		.describe("Home-loan interest paid in the tax year, in THB; needs --tax."),
	donation2x: z
		.number()
		.min(0)
		.optional()
		.describe(
			"Donations that the statute counts twice, such as education and hospitals, in THB; needs --tax.",
		),
	donation1x: z.number().min(0).optional().describe("Donations counted once, in THB; needs --tax."),
}
