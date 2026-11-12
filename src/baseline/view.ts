import { z } from "zod"
import type { AccountRef } from "../account/view"
import { accountRef } from "../account/view"
import type { SimKind } from "./kind"

export const SIM_KIND_VALUES: readonly [SimKind, ...SimKind[]] = ["asset", "liability"]

/** One Balance in a `baseline show` result: the Account, the kind it implies, its figure. */
export type BaselineRow = {
	account: AccountRef
	kind: SimKind
	amount: string
}

/** `traj baseline show`: the Baseline a Projection starts from, at one As-of. */
export type BaselineShow = {
	asOf: string
	currency: string
	rows: BaselineRow[]
}

export const baselineRow: z.ZodType<BaselineRow> = z.strictObject({
	account: accountRef.describe("The Account this Balance belongs to, in the Ledger's own id."),
	kind: z
		.enum(SIM_KIND_VALUES)
		.describe("The sim-core kind the Account's Ledger type implies; the Scenario declares it."),
	amount: z
		.string()
		.describe(
			"Decimal string at the currency's own scale; a liability is positive, the debt owed.",
		),
})

export const baselineShow: z.ZodType<BaselineShow> = z.strictObject({
	asOf: z.string().describe("The date the Baseline is stated at, as YYYY-MM-DD."),
	currency: z.string().describe("The Baseline's ISO 4217 currency; v1 is THB only."),
	rows: z
		.array(baselineRow)
		.describe("One row per Balance, in ascending Account-id order, as the core sorts them."),
})
