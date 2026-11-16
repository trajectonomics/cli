import type { Leaf } from "./command"
import {
	exclusiveFields,
	missingFieldError,
	parseDocument,
	readDocument,
	selectionSchema,
} from "./document"
import { type AppError, fail, isAppError } from "./errors"
import { isVariadic, toKebab } from "./flags"
import { dispatchFailure, inputFailure } from "./invalid"
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

function validate(
	leaf: Leaf,
	raw: Record<string, unknown>,
	path: readonly string[],
): { input: unknown } | AppError {
	const result = leaf.input.safeParse(raw, { reportInput: true })
	return result.success ? { input: result.data } : inputFailure(leaf, path, result.error)
}

type ParsedInput = { input: unknown; document?: unknown }

/** The document form: only its own flags, then the JSON document named by `flag` (ADR-0020). */
async function documentForm(
	leaf: Leaf,
	fields: Record<string, unknown>,
	path: readonly string[],
	stdin: () => Promise<string>,
): Promise<ParsedInput | AppError | undefined> {
	const spec = leaf.document
	if (spec === undefined) return undefined
	const ref = fields[spec.flag]
	if (ref === undefined) return undefined
	const flag = `--${toKebab(spec.flag)}`
	if (typeof ref !== "string") {
		return fail("invalid_input", { path: spec.flag, message: `${flag} must be a path` })
	}
	const mixed = exclusiveFields(leaf.input, spec).filter((field) => fields[field] !== undefined)
	if (mixed.length > 0) {
		const flags = mixed.map((field) => `--${toKebab(field)}`).join(", ")
		return fail("invalid_input", {
			path: spec.flag,
			message: `${flag} cannot be combined with ${flags}`,
		})
	}
	const selection = selectionSchema(leaf.input, spec).safeParse(fields, { reportInput: true })
	if (!selection.success) return inputFailure(leaf, path, selection.error)
	const missing = (spec.required ?? []).find((entry) => selection.data[entry.field] === undefined)
	if (missing !== undefined) return missingFieldError(missing)
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
	const document = await documentForm(leaf, fields, path, stdin)
	if (document === undefined) return validate(leaf, fields, path)
	// A document failure names the field a caller can correct, so it follows the same rewrite as a
	// command-raised one; a document path already starts with `document.` and passes through.
	return isAppError(document) ? dispatchFailure(leaf, path, document) : document
}
