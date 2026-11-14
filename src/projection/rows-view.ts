import { z } from "zod"
import { dateField, moneyField } from "./money"

/** One year of the engine's roll-up, nominal, beside the real figure at its own date. */
export type AnnualRow = {
	index: number
	from: string
	to: string
	openingNetWorth: string
	closingNetWorth: string
	income: string
	expense: string
	contributions: string
	unfundedContributions: string
	interest: string
	unmet: string
	partial: boolean
	realNetWorth: { date: string; amount: string }
}

/** One monthly row of the Projection, nominal and real. */
export type MonthlyRow = {
	date: string
	netWorth: string
	realNetWorth: string
	accessibleNetWorth: string
	realAccessibleNetWorth: string
}

export const annualRow: z.ZodType<AnnualRow> = z.strictObject({
	index: z.number().int().describe("The roll-up's index, from 0."),
	from: dateField("The roll-up's first day"),
	to: dateField("The roll-up's last day"),
	openingNetWorth: moneyField("Net worth on the roll-up's first day"),
	closingNetWorth: moneyField("Net worth on the roll-up's last day"),
	income: moneyField("Income the roll-up landed"),
	expense: moneyField("Expense the roll-up landed"),
	contributions: moneyField("Contributions the roll-up funded"),
	unfundedContributions: moneyField("Contributions the roll-up could not fund"),
	interest: moneyField("Interest the roll-up accrued"),
	unmet: moneyField("Spending the roll-up could not fund"),
	partial: z
		.boolean()
		.describe("True when the roll-up covers less than a year, as the last one does."),
	realNetWorth: z
		.strictObject({
			date: dateField("The monthly row these real terms are measured at"),
			amount: moneyField("Net worth in the Projection's start-of-timeline terms"),
		})
		.describe(
			"The engine's real net worth at the roll-up's end, dated where the engine states it.",
		),
})

export const monthlyRow: z.ZodType<MonthlyRow> = z.strictObject({
	date: dateField("The row's date"),
	netWorth: moneyField("Net worth on the row's date"),
	realNetWorth: moneyField("Net worth in start-of-timeline terms"),
	accessibleNetWorth: moneyField("Net worth that is not locked"),
	realAccessibleNetWorth: moneyField("Accessible net worth in start-of-timeline terms"),
})
