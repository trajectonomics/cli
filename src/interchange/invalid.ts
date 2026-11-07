import { type AppError, fail } from "../errors"

/** `invalid_input` at `path` (`line.<n>[.<key>]`), with the path leading the message. */
export function invalid(path: string, reason: string, details?: unknown): AppError {
	const message = `${path}: ${reason}`
	return fail(
		"invalid_input",
		details === undefined ? { path, message } : { path, message, details },
	)
}

/** A parsed line that is a JSON object, or the reason it is not. */
export function parseLine(line: string, path: string): Record<string, unknown> | AppError {
	let value: unknown
	try {
		value = JSON.parse(line)
	} catch {
		return invalid(path, "is not valid JSON")
	}
	const isObject = typeof value === "object" && value !== null && !Array.isArray(value)
	return isObject ? (value as Record<string, unknown>) : invalid(path, "is not a JSON object")
}

/** Refuses a record whose keys are not exactly `expected`, in that order. */
export function exactKeys(
	record: Record<string, unknown>,
	expected: readonly string[],
	path: string,
): AppError | null {
	const actual = Object.keys(record)
	if (actual.length === expected.length && actual.every((key, i) => key === expected[i])) {
		return null
	}
	return invalid(path, `keys must be exactly ${expected.join(", ")} in that order`, {
		expected,
		actual,
	})
}
