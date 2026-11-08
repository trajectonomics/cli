import { z } from "zod"
import type { TxAmended } from "../store"
import { viewTransactionBody, type WrittenTransactionBody, writtenTransactionBody } from "./view"

/** The two answers an amend gives: the amendment it wrote, or the correction already standing. */
export type WrittenAmendment = {
	dryRun: boolean
	status: "amended" | "already_corrected"
	reversal: WrittenTransactionBody | null
	replacement: WrittenTransactionBody | null
	correction: WrittenTransactionBody | null
}

export const writtenAmendment: z.ZodType<WrittenAmendment> = z.strictObject({
	dryRun: z.boolean().describe("True when the write was rolled back."),
	status: z
		.enum(["amended", "already_corrected"])
		.describe("What the amend found; already_corrected wrote nothing."),
	reversal: writtenTransactionBody
		.nullable()
		.describe("The reversal written, or null when a correction already stands."),
	replacement: writtenTransactionBody
		.nullable()
		.describe("The replacement written, or null when a correction already stands."),
	correction: writtenTransactionBody
		.nullable()
		.describe("The correction already standing, or null when the amend wrote one."),
})

/** Both rows an amend wrote, or the correction that already stood; ids are null under a dry run. */
export function viewAmendment(
	amended: Exclude<TxAmended, { status: "not_found" }>,
	dryRun: boolean,
): WrittenAmendment {
	if (amended.status === "already_corrected") {
		return {
			dryRun,
			status: "already_corrected",
			reversal: null,
			replacement: null,
			correction: viewTransactionBody(amended, false),
		}
	}
	return {
		dryRun,
		status: "amended",
		reversal: viewTransactionBody(amended.reversal, dryRun),
		replacement: viewTransactionBody(amended.replacement, dryRun),
		correction: null,
	}
}
