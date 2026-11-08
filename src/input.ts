import type { z } from "zod"
import type { Leaf } from "./command"
import { exclusiveFields, parseDocument, readDocument, selectionSchema } from "./document"
import { type AppError, fail, isAppError, registry } from "./errors"
import { isVariadic, toKebab } from "./flags"
import type { Parsed } from "./parse"

/** Maps positional words onto the leaf's positional fields; the last may take all the rest. */
function fillPositionals(
	leaf: Leaf,
	words: readonly string[],
	path: readonly string[],
): Record<string, unknown> | AppError {
	const last = leaf.positionals.at(-1)
	const variadic = last !== undefined && isVariadic(leaf.input, last)
	if (!variadic && words.length > leaf.positionals.length) {
		return fail("invalid_input", {
			message: `Unexpected argument: ${words[leaf.positionals.length]}`,
			hint: `Run "traj help ${path.join(" ")}" to see its input.`,
		})
	}
	return assign(leaf, words, variadic)
}

function assign(leaf: Leaf, words: readonly string[], variadic: boolean): Record<string, unknown> {
	const fields: Record<string, unknown> = {}
	const lastIndex = leaf.positionals.length - 1
	for (const [index, name] of leaf.positionals.entries()) {
		const value = variadic && index === lastIndex ? words.slice(index) : words[index]
		// An empty list means "not given", so a schema default can apply.
		const given = Array.isArray(value) ? value.length > 0 : value !== undefined
		if (given) fields[name] = value
	}
	return fields
}

function invalid(error: z.ZodError): AppError {
	const issues = error.issues.map((issue) => ({
		path: issue.path.join("."),
		message: issue.message,
	}))
	const first = issues[0]
	return fail("invalid_input", {
		message: first?.message ?? registry.invalid_input.message,
		...(first?.path ? { path: first.path } : {}),
		details: issues,
	})
}

function validate(leaf: Leaf, raw: Record<string, unknown>): { input: unknown } | AppError {
	const result = leaf.input.safeParse(raw)
	return result.success ? { input: result.data } : invalid(result.error)
}

type ParsedInput = { input: unknown; document?: unknown }

/** The document form: only its own flags, then the JSON document named by `flag` (ADR-0020). */
async function documentForm(
	leaf: Leaf,
	fields: Record<string, unknown>,
	stdin: () => Promise<string>,
): Promise<ParsedInput | AppError | undefined> {
	const spec = leaf.document
	if (spec === undefined) return undefined
	const ref = fields[spec.flag]
	if (ref === undefined) return undefined
	if (typeof ref !== "string") {
		return fail("invalid_input", { path: spec.flag, message: `${spec.flag} must be a path` })
	}
	const mixed = exclusiveFields(leaf.input, spec).filter((field) => fields[field] !== undefined)
	if (mixed.length > 0) {
		const flags = mixed.map((field) => `--${toKebab(field)}`).join(", ")
		return fail("invalid_input", {
			path: spec.flag,
			message: `--${toKebab(spec.flag)} cannot be combined with ${flags}`,
		})
	}
	const selection = selectionSchema(leaf.input, spec).safeParse(fields)
	if (!selection.success) return invalid(selection.error)
	const text = await readDocument(ref, spec.flag, stdin)
	if (isAppError(text)) return text
	const document = parseDocument(spec, text, spec.flag)
	return isAppError(document) ? document : { input: selection.data, document }
}

/** Fills positional fields from words, reads a document when one is named, and validates it. */
export async function parseInput(
	leaf: Leaf,
	parsed: Parsed,
	path: readonly string[],
	stdin: () => Promise<string>,
): Promise<ParsedInput | AppError> {
	const positional = fillPositionals(leaf, parsed.positionals, path)
	if (isAppError(positional)) return positional
	const fields = { ...parsed.fields, ...positional }
	const document = await documentForm(leaf, fields, stdin)
	return document ?? validate(leaf, fields)
}
