import { readFileSync } from "node:fs"
import { type AppError, fail } from "../errors"

function unreadable(ref: string): AppError {
	return fail("invalid_input", { path: "file", message: `file: cannot read "${ref}"` })
}

function notUtf8(where: string): AppError {
	return fail("invalid_input", {
		path: "file",
		message: `file: ${where} is not valid UTF-8 text`,
		hint: "Save the CSV as UTF-8 and retry.",
	})
}

/**
 * The CSV's text: a file decoded strictly (invalid bytes are invalid input, never a corrupted
 * memo), or all of stdin. The text seam replaces invalid bytes with U+FFFD, so a replacement
 * character from stdin means the input was not the UTF-8 the template requires.
 */
export async function readSource(
	ref: string,
	stdin: () => Promise<string>,
): Promise<string | AppError> {
	if (ref === "-") {
		try {
			const text = await stdin()
			return text.includes("\uFFFD") ? notUtf8("stdin") : text
		} catch {
			return fail("invalid_input", { path: "file", message: "file: cannot read stdin" })
		}
	}
	let bytes: Uint8Array
	try {
		bytes = readFileSync(ref)
	} catch {
		return unreadable(ref)
	}
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
	} catch {
		return notUtf8(`"${ref}"`)
	}
}
