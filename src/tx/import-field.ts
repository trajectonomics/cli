import { type AppError, fail } from "../errors"

/** Where the scanner is: a byte offset and the physical line it sits on. */
export type Cursor = { index: number; line: number }

function strayQuote(line: number): AppError {
	return fail("invalid_input", {
		path: `line.${line}`,
		message: `line.${line}: a quote inside an unquoted field must be doubled or the field quoted`,
	})
}

function unclosedQuote(quoteLine: number): AppError {
	return fail("invalid_input", {
		path: `line.${quoteLine}`,
		message: `line.${quoteLine}: a quoted field opened here is never closed`,
	})
}

function afterQuote(line: number): AppError {
	return fail("invalid_input", {
		path: `line.${line}`,
		message: `line.${line}: a quoted field must be followed by a comma or the end of the row`,
	})
}

/** What follows a closing quote: a comma, the end of the row, or a syntax error. */
function closed(
	value: string,
	text: string,
	cursor: Cursor,
	recordLine: number,
): string | AppError {
	const next = text[cursor.index]
	return next === undefined || next === "," || next === "\n" ? value : afterQuote(recordLine)
}

/** A quoted field, verbatim; `""` is one quote and a line break raises later lines. */
export function quotedField(text: string, cursor: Cursor, recordLine: number): string | AppError {
	const quoteLine = cursor.line
	cursor.index += 1
	let value = ""
	while (cursor.index < text.length) {
		const char = text[cursor.index] as string
		if (char === '"' && text[cursor.index + 1] === '"') {
			value += '"'
			cursor.index += 2
			continue
		}
		if (char === '"') {
			cursor.index += 1
			return closed(value, text, cursor, recordLine)
		}
		if (char === "\n") cursor.line += 1
		value += char
		cursor.index += 1
	}
	return unclosedQuote(quoteLine)
}

/** An unquoted field, trimmed; a quote inside it is a syntax error at the record's line. */
export function unquotedField(text: string, cursor: Cursor, recordLine: number): string | AppError {
	let value = ""
	while (cursor.index < text.length) {
		const char = text[cursor.index] as string
		if (char === "," || char === "\n") break
		if (char === '"') return strayQuote(recordLine)
		value += char
		cursor.index += 1
	}
	return value.trim()
}
