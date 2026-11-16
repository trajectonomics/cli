import type { z } from "zod"
import type { Leaf } from "./command"
import { type AppError, fail, registry } from "./errors"
import { type InputKind, sentenceOf } from "./sentences"

/** One `details` row: the input path and the CLI's sentence for the reason. */
export type Row = { path?: string; message: string; code?: string }

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** The hint `unknown_flag` prints, reused wherever a failure names an input field. */
export function inputHint(commandPath: readonly string[]): string {
	const words = commandPath.map((word) => ` ${word}`).join("")
	return `Run "traj help${words}" to see its flags.`
}

/**
 * The caller's spelling of one input field: a flag is `--kebab-case`, and a positional keeps its
 * declared name (`file`). The validator only ever sees the schema field (`asOf`, `file`).
 */
function inputSpelling(leaf: Leaf, field: string): string | undefined {
	if (leaf.positionals.includes(field)) return field
	const flag = leaf.flags.find((spec) => spec.field === field)
	return flag === undefined ? undefined : `--${flag.flag}`
}

/** `document` plus the validator's path, keeping indexes: `document.postings.0.amount`. */
export function documentPathOf(segments: readonly PropertyKey[]): string {
	return ["document", ...segments.map(String)].filter((part) => part !== "").join(".")
}

function issueField(issue: z.core.$ZodIssue): string | undefined {
	const first = issue.path[0]
	return first === undefined ? undefined : String(first)
}

/** Rewrites the first path segment to the caller's spelling; a repeated flag drops its index. */
function inputRows(leaf: Leaf, error: z.ZodError): Row[] {
	return error.issues.map((issue) => {
		const field = issueField(issue)
		const path = field === undefined ? undefined : inputSpelling(leaf, field)
		const kind: InputKind =
			field !== undefined && leaf.positionals.includes(field) ? "argument" : "flag"
		return {
			...(path === undefined ? {} : { path }),
			message: sentenceOf(issue, kind),
		}
	})
}

/** The one envelope both schema-validation steps build: the first row names the failure. */
export function issueFailure(rows: Row[], hint?: string): AppError {
	const first = rows[0]
	return fail("invalid_input", {
		message: first?.message ?? registry.invalid_input.message,
		...(first?.path === undefined ? {} : { path: first.path }),
		...(hint === undefined ? {} : { hint }),
		details: rows,
	})
}

/** The `invalid_input` the routing step builds from a leaf's input schema. */
export function inputFailure(
	leaf: Leaf,
	commandPath: readonly string[],
	error: z.ZodError,
): AppError {
	const rows = inputRows(leaf, error)
	// An input-schema issue always names a flag or a positional, so the hint follows the path.
	const named = rows[0]?.path !== undefined
	return issueFailure(rows, named ? inputHint(commandPath) : undefined)
}

type InputPath = { field: string; spelling: string }

/**
 * The input field a command-raised path names, when it is exactly one field. A dotted path is a
 * document path and stays: `scenario.schemaVersion` must not become `--scenario.schemaVersion`.
 */
function inputPathOf(leaf: Leaf, path: string | undefined): InputPath | undefined {
	if (path === undefined || path === "" || path.includes(".")) return undefined
	const spelling = inputSpelling(leaf, path)
	return spelling === undefined ? undefined : { field: path, spelling }
}

/** Drops a leading `<field>: `, so prose does not repeat the name the `path` already carries. */
function withoutPrefix(field: string, message: string): string {
	const prefix = `${field}: `
	if (!message.startsWith(prefix)) return message
	const rest = message.slice(prefix.length)
	const first = rest.charAt(0)
	return first >= "a" && first <= "z" ? `${first.toUpperCase()}${rest.slice(1)}` : rest
}

function rewriteRow(leaf: Leaf, row: unknown): unknown {
	if (!isRecord(row)) return row
	const path = row["path"]
	const message = row["message"]
	if (typeof path !== "string" || typeof message !== "string") return row
	const input = inputPathOf(leaf, path)
	if (input === undefined) return row
	return { ...row, path: input.spelling, message: withoutPrefix(input.field, message) }
}

/**
 * The dispatch step's rewrite of an `invalid_input` raised after schema validation, whether by the
 * command or by the document form that ran before it. It names an input field only when the whole
 * path is one (`out` is `--out`, `file` stays `file`), gains the generic help hint when it has
 * none, and drops a leading `<field>: ` from its message. Rows of an array `details` follow the
 * same rule; object `details` pass through untouched. Every other code is out of scope (ADR-0013).
 */
export function dispatchFailure(
	leaf: Leaf,
	commandPath: readonly string[],
	error: AppError,
): AppError {
	if (error.body.code !== "invalid_input") return error
	const body = error.body
	const input = inputPathOf(leaf, body.path)
	const hint = input === undefined ? body.hint : (body.hint ?? inputHint(commandPath))
	const details = Array.isArray(body.details)
		? body.details.map((row) => rewriteRow(leaf, row))
		: body.details
	return fail("invalid_input", {
		message: input === undefined ? body.message : withoutPrefix(input.field, body.message),
		...(input === undefined
			? body.path === undefined
				? {}
				: { path: body.path }
			: { path: input.spelling }),
		...(hint === undefined ? {} : { hint }),
		...(details === undefined ? {} : { details }),
	})
}
