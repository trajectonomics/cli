import type { ThFilingStatus } from "@trajectonomics/tax/th"
import { type AppError, fail } from "../../errors"
import { ALLOWANCE_FLAGS, allowancesOf, type TaxAllowances } from "./allowances"
import { labelSetsSentence } from "./labels"

export type { ThFilingStatus }

/** The tax the CLI can apply today; a second jurisdiction adds a value, not a flag (ADR-0032). */
export type TaxJurisdiction = "th-2026"

/**
 * The flags that ask for tax; without `tax` the others are refused rather than ignored. The
 * allowance fields are the shared `TaxAllowances` keys, so a new deduction has one list to join.
 */
export type TaxFlags = {
	tax?: TaxJurisdiction | undefined
	filingStatus?: ThFilingStatus | undefined
	children?: number | undefined
	childrenAtHigherRate?: number | undefined
	/** `scenario tax --none` removes the Levy instead of writing one. */
	none?: boolean | undefined
} & { readonly [K in keyof TaxAllowances]?: number | undefined }

/** What the caller asked the CLI to write, with every default resolved. */
export type TaxRequest = {
	jurisdiction: TaxJurisdiction
	filingStatus: ThFilingStatus
	children: number
	childrenAtHigherRate: number
	allowances: TaxAllowances
}

/** A filing status a caller may name; the values are tax-core's own enum. */
export const FILING_STATUSES: readonly [ThFilingStatus, ...ThFilingStatus[]] = [
	"single",
	"married_no_income_spouse",
	"married_separate",
	"married_joint",
	"married_separate_40_1_joint_rest",
]

/**
 * The `--label` flag's one description, so usage and `traj schema` publish the same closed sets
 * (ADR-0010). Both lists are `@trajectonomics/tax`'s own exports: a pin bump that changes them
 * changes what this says, and no label is restated here (ADR-0032).
 */
export function labelFlagDescription(): string {
	return [
		"Classify one Flow for tax as <flow>=<label>, such as salary=income.section40_1; repeatable and needs --tax.",
		labelSetsSentence(),
	].join(" ")
}

/** `--none` beside any flag that writes a Levy: one or the other, never both. */
function noneConflict(flags: TaxFlags): AppError | null {
	if (flags.none !== true) return null
	const writer =
		flags.tax !== undefined ||
		flags.filingStatus !== undefined ||
		flags.children !== undefined ||
		flags.childrenAtHigherRate !== undefined ||
		ALLOWANCE_FLAGS.some((field) => flags[field] !== undefined)
	if (!writer) return null
	return fail("invalid_input", {
		message: "--none removes the tax, so it cannot be combined with the flags that write one.",
		path: "none",
	})
}

/** A profile flag with no `--tax`: it would be ignored, so it is refused instead. */
function missingTax(flags: TaxFlags): AppError | null {
	if (flags.tax !== undefined) return null
	const profile = flags.filingStatus !== undefined
	const allowance = ALLOWANCE_FLAGS.find((field) => flags[field] !== undefined)
	if (
		!profile &&
		flags.children === undefined &&
		flags.childrenAtHigherRate === undefined &&
		allowance === undefined
	) {
		return null
	}
	const field = profile ? "filingStatus" : (allowance ?? "children")
	return fail("invalid_input", {
		message: `${flagOf(field)} needs --tax: without it no Levy is written and the flag would be ignored.`,
		path: field,
	})
}

/** A count of children the statute allows at the higher rate cannot exceed the children counted. */
function higherRateConflict(flags: TaxFlags): AppError | null {
	if ((flags.childrenAtHigherRate ?? 0) <= (flags.children ?? 0)) return null
	return fail("invalid_input", {
		message:
			"--children-at-higher-rate counts children that --children also counts, so it cannot exceed it.",
		path: "childrenAtHigherRate",
	})
}

/** The caller's spelling of one field, so a refusal names the flag rather than the schema key. */
function flagOf(field: string): string {
	return `--${field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
}

/** The caller's flags as one request, `null` when none was given, or why they cannot be honoured. */
export function taxRequestOf(flags: TaxFlags): TaxRequest | AppError | null {
	const refused = noneConflict(flags) ?? missingTax(flags) ?? higherRateConflict(flags)
	if (refused !== null) return refused
	if (flags.tax === undefined) return null
	return {
		jurisdiction: flags.tax,
		filingStatus: flags.filingStatus ?? "single",
		children: flags.children ?? 0,
		childrenAtHigherRate: flags.childrenAtHigherRate ?? 0,
		allowances: allowancesOf(flags),
	}
}
