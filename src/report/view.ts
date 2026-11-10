import type { AccountType } from "@trajectonomics/ledger"
import { z } from "zod"
import { type AccountRef, accountRef } from "../account/view"

/** One Account's amount in a report: named, typed, and rendered at its currency's scale. */
export type ReportRow = {
	account: AccountRef
	type: AccountType
	amount: string
	currency: string
}

/** One per-currency total. */
export type TotalView = { currency: string; amount: string }

/** One Account's Trial Balance row: its net Balance split into non-negative magnitudes. */
export type TrialRowView = {
	account: AccountRef
	debit: string
	credit: string
	currency: string
}

/** One per-currency Trial Balance total. */
export type TrialTotalView = { currency: string; debit: string; credit: string }

export type TrialBalanceView = { rows: TrialRowView[]; totals: TrialTotalView[] }

export const reportRow: z.ZodType<ReportRow> = z.strictObject({
	account: accountRef.describe("The Account this Balance belongs to."),
	type: z
		.enum(["asset", "liability", "equity", "income", "expense"])
		.describe("The Account's type, which says how to read the raw sign."),
	amount: z.string().describe("Decimal string at the currency's own scale; raw signed units."),
	currency: z.string().describe("The row's ISO 4217 currency; v1 is THB only."),
})

export const totalView: z.ZodType<TotalView> = z.strictObject({
	currency: z.string().describe("The total's ISO 4217 currency; v1 is THB only."),
	amount: z.string().describe("Decimal string at the currency's own scale."),
})

export const trialRow: z.ZodType<TrialRowView> = z.strictObject({
	account: accountRef.describe("The Account this row belongs to."),
	debit: z.string().describe("The non-negative magnitude in the debit column."),
	credit: z.string().describe("The non-negative magnitude in the credit column."),
	currency: z.string().describe("The row's ISO 4217 currency; v1 is THB only."),
})

export const trialTotal: z.ZodType<TrialTotalView> = z.strictObject({
	currency: z.string().describe("The total's ISO 4217 currency; v1 is THB only."),
	debit: z.string().describe("The sum of every row's debit, a non-negative decimal string."),
	credit: z.string().describe("The sum of every row's credit, a non-negative decimal string."),
})

export const trialBalanceView: z.ZodType<TrialBalanceView> = z.strictObject({
	rows: z.array(trialRow).describe("One row per Leaf Account, in `account list` order."),
	totals: z.array(trialTotal).describe("One entry per currency, by currency."),
})
