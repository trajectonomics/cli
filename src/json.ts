/**
 * A plain JSON object: not null, not an array, and not a class instance, so `JSON.parse` output
 * and object literals pass while a `Date` or `Map` does not.
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== "object" || value === null) return false
	const proto = Object.getPrototypeOf(value)
	return proto === Object.prototype || proto === null
}
