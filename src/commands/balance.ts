import { z } from "zod"
import type { Leaf } from "../command"
import { defineCommand, ok } from "../command"
import { isAppError } from "../errors"
import { type BalanceResult, balanceOf } from "../report/balance"
import { reportRow, totalView, trialBalanceView } from "../report/view"
import { LEDGER_READ_CODES } from "../store"
import { withStore } from "../with-store"

const resultSchema: z.ZodType<BalanceResult> = z.strictObject({
	asOf: z.string().describe("The date the balances are stated at, as YYYY-MM-DD."),
	rows: z.array(reportRow).describe("One row per Leaf Account, in `account list` order."),
	netWorth: z.array(totalView).describe("Assets minus liabilities, one entry per currency."),
	trialBalance: trialBalanceView
		.optional()
		.describe("The Trial Balance, present only when --trial-balance is given."),
})

export const balance: Leaf = defineCommand({
	name: "balance",
	summary: "Show every account's balance and net worth at a date",
	positionals: [],
	input: z.strictObject({
		asOf: z.string().describe("The date the balances are stated at, as YYYY-MM-DD."),
		trialBalance: z
			.boolean()
			.optional()
			.describe("Add the Trial Balance and assert its debit and credit totals agree."),
	}),
	output: resultSchema,
	examples: [
		{
			command: "traj balance --as-of 2026-03-31 --json",
			description: "Every account's balance and net worth at one date.",
		},
		{
			command: "traj balance --as-of 2026-03-31 --trial-balance",
			description: "Add the trial balance and check that debits equal credits.",
		},
	],
	errorCodes: ["INVALID_DATE", "AMOUNT_OVERFLOW", ...LEDGER_READ_CODES],
	run: (input, ctx) =>
		withStore(ctx, (store) => {
			const ledger = store.ledger()
			if (isAppError(ledger)) return ledger
			const result = balanceOf(ledger, input)
			return isAppError(result) ? result : ok(result)
		}),
})
