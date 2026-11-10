import { type AppError, isAppError } from "../errors"
import { type Cursor, quotedField, unquotedField } from "./import-field"

/** One record as parsed: the physical line it starts on and its cells, already trimmed. */
export type RawRecord = { line: number; fields: string[] }

/** One record: its cells, the line it opened on, and whether it was a blank line. */
function nextRecord(
	text: string,
	cursor: Cursor,
): { line: number; fields: string[]; blank: boolean } | AppError {
	const recordLine = cursor.line
	const fields: string[] = []
	let anyQuoted = false
	while (true) {
		const quoted = text[cursor.index] === '"'
		anyQuoted ||= quoted
		const value = quoted
			? quotedField(text, cursor, recordLine)
			: unquotedField(text, cursor, recordLine)
		if (isAppError(value)) return value
		fields.push(value)
		const separator = text[cursor.index]
		if (separator === ",") {
			cursor.index += 1
			continue
		}
		if (separator === "\n") {
			cursor.index += 1
			cursor.line += 1
		}
		break
	}
	return { line: recordLine, fields, blank: fields.length === 1 && fields[0] === "" && !anyQuoted }
}

/**
 * LF, CRLF and a bare CR are all one line break, so a file saved by either kind of tool parses
 * to the same cells, memo and content key. A leading BOM is dropped before anything else.
 */
function normalize(text: string): string {
	const body = text.startsWith("\uFEFF") ? text.slice(1) : text
	return body.replaceAll("\r\n", "\n").replaceAll("\r", "\n")
}

/**
 * RFC 4180 records in order, with unquoted cells trimmed and quoted cells kept verbatim. It
 * yields one record at a time, so the reader can check the header and each row's width before
 * the next record is scanned; a syntax error is the last thing it yields.
 */
export function* recordsOf(text: string): Generator<RawRecord | AppError> {
	const normalized = normalize(text)
	const cursor: Cursor = { index: 0, line: 1 }
	while (cursor.index < normalized.length) {
		const record = nextRecord(normalized, cursor)
		if (isAppError(record)) {
			yield record
			return
		}
		if (!record.blank) yield { line: record.line, fields: record.fields }
	}
}
