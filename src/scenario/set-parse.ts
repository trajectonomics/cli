import { type AppError, fail, isAppError } from "../errors"

/** One parsed `--set`: the dotted segments and the JSON value they take. */
export type ParsedSet = { segments: string[]; value: unknown }

const SET_HINT = "A --set is path=json, such as --set streams.salary.amount=50000."

/** An invalid `--set` always points at the input field `set`, never at a document path. */
export function badSet(
	index: number,
	message: string,
	options: { hint?: string; details?: Record<string, unknown> } = {},
): AppError {
	return fail("invalid_input", {
		path: "set",
		message: `set: ${message}`,
		hint: options.hint ?? SET_HINT,
		details: { index, ...options.details },
	})
}

/** Splits at the first unescaped `=`; a backslash only shields the next character here. */
export function splitAssignment(
	raw: string,
	index: number,
): { path: string; value: string } | AppError {
	for (let at = 0; at < raw.length; at += 1) {
		const char = raw[at]
		if (char === "\\") {
			if (at + 1 >= raw.length) {
				return badSet(index, `"${raw}" ends with a dangling \\`, { details: { path: raw } })
			}
			at += 1
			continue
		}
		if (char === "=") return { path: raw.slice(0, at), value: raw.slice(at + 1) }
	}
	return badSet(index, `"${raw}" has no unescaped = between the path and the value`, {
		details: { path: raw },
	})
}

const SEGMENT = /(?:\\.|[^.])+/g

function unescapeSegment(part: string, index: number): string | AppError {
	let text = ""
	for (let at = 0; at < part.length; at += 1) {
		const char = part[at] ?? ""
		if (char !== "\\") {
			text += char
			continue
		}
		const next = part[at + 1]
		if (next === undefined || !".\\=".includes(next)) {
			return badSet(index, `"${part}" uses an escape other than \\. \\\\ or \\=`, {
				hint: "Only \\. \\\\ and \\= are escapes; any other backslash is invalid.",
				details: { path: part },
			})
		}
		text += next
		at += 1
	}
	return text
}

/** Unescapes one dotted path: `\.`, `\\` and `\=` are literals, any other escape is invalid. */
export function parsePath(text: string, index: number): string[] | AppError {
	if (text === "") return badSet(index, "the path before = is empty", { details: { path: text } })
	const parts = text.match(SEGMENT) ?? []
	if (parts.join(".") !== text) {
		return badSet(index, `"${text}" has an empty segment`, { details: { path: text } })
	}
	const segments: string[] = []
	for (const part of parts) {
		const segment = unescapeSegment(part, index)
		if (isAppError(segment)) return segment
		segments.push(segment)
	}
	return segments
}

function parseValue(text: string, index: number): unknown | AppError {
	try {
		return JSON.parse(text)
	} catch {
		return badSet(index, `"${text}" is not JSON`, {
			hint: 'A --set value is a JSON literal: 50000 is a number, "50000" a string. Quote a string.',
			details: { path: text },
		})
	}
}

/** Parses one `path=json` string; nothing about the document is read here. */
export function parseSet(raw: string, index: number): ParsedSet | AppError {
	const parts = splitAssignment(raw, index)
	if (isAppError(parts)) return parts
	const segments = parsePath(parts.path, index)
	if (isAppError(segments)) return segments
	const value = parseValue(parts.value, index)
	return isAppError(value) ? value : { segments, value }
}
