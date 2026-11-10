/** A cell's text before any escaping: a null is empty, an object is its compact JSON. */
export function plain(value: unknown): string {
	if (value === null || value === undefined) return ""
	if (typeof value === "string") return value
	if (typeof value === "number" || typeof value === "boolean") return String(value)
	return JSON.stringify(value) ?? ""
}

/** C0 and C1: everything a terminal could act on rather than print. */
function isControl(code: number): boolean {
	return code < 0x20 || (code >= 0x7f && code <= 0x9f)
}

const NAMED: Readonly<Record<string, string>> = {
	"\\": "\\\\",
	"\n": "\\n",
	"\r": "\\r",
	"\t": "\\t",
}

function escaped(char: string): string {
	const named = NAMED[char]
	if (named !== undefined) return named
	const code = char.codePointAt(0) ?? 0
	return isControl(code) ? `\\u${code.toString(16).padStart(4, "0")}` : char
}

/**
 * One table cell: `null` and an empty string are both empty, and a backslash or any C0/C1
 * control character is escaped, so a memo can neither break the row nor reach the terminal as
 * a control code. Nothing is truncated.
 */
export function cell(value: unknown): string {
	return [...plain(value)].map(escaped).join("")
}
