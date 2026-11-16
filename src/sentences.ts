import type { z } from "zod"
import { registry } from "./errors"

/**
 * The CLI's own sentences for the reasons a schema validation can fail (ADR-0013). They are text,
 * not codes: `traj schema` keeps one `invalid_input` row and the table adds no exit class. The
 * validation library's wording never reaches the envelope.
 */
export const SENTENCES = {
	requiredFlag: "A required flag is missing.",
	requiredArgument: "A required argument is missing.",
	requiredField: "A required field is missing.",
	number: "The value must be a number.",
	wholeNumber: "The value must be a whole number.",
	empty: "The value must not be empty.",
	range: "The value is outside its allowed range.",
	choice: "The value is not one of the allowed choices.",
	unexpectedField: "The document has an unexpected field.",
	documentShape: "The document does not match its schema.",
} as const

/** Which input a required sentence names: a flag, a positional argument, or a document field. */
export type InputKind = "flag" | "argument" | "document"

type Issue = z.core.$ZodIssue

/** True when the validator received `undefined`, whatever issue kind it chose to report. */
function receivedNothing(issue: Issue): boolean {
	return "input" in issue && issue.input === undefined
}

function requiredSentence(kind: InputKind): string {
	if (kind === "flag") return SENTENCES.requiredFlag
	return kind === "argument" ? SENTENCES.requiredArgument : SENTENCES.requiredField
}

function rangeSentence(issue: Issue): string {
	const empty = issue.code === "too_small" && issue.origin === "string" && issue.minimum === 1
	return empty ? SENTENCES.empty : SENTENCES.range
}

function typeSentence(issue: Issue): string | undefined {
	if (issue.code !== "invalid_type") return undefined
	if (issue.expected === "int") return SENTENCES.wholeNumber
	if (issue.expected === "number") return SENTENCES.number
	return undefined
}

/** The sentence for an issue kind this table knows, or `undefined` when it knows none. */
function knownSentence(issue: Issue): string | undefined {
	if (issue.code === "invalid_value") return SENTENCES.choice
	if (issue.code === "too_small" || issue.code === "too_big") return rangeSentence(issue)
	return typeSentence(issue)
}

/**
 * The CLI sentence for one validator issue. A received `undefined` is the required sentence before
 * the issue kind, because a missing `z.enum` flag reports `invalid_value`. A `custom` issue keeps
 * the sentence it was authored with, so a core's own words survive. Everything unmapped is the
 * registry's `The input is invalid.` outside a document, and the document's shape inside one.
 */
export function sentenceOf(issue: Issue, kind: InputKind): string {
	if (issue.code === "custom") return issue.message
	if (receivedNothing(issue)) return requiredSentence(kind)
	const known = knownSentence(issue)
	return known ?? (kind === "document" ? SENTENCES.documentShape : registry.invalid_input.message)
}
