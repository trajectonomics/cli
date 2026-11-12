// The dotted-path grammar shared by `scenario fork --set` and `scenario diff` (ADR-0024):
// object keys separated by dots, list items addressed by their stable string `id`, and a literal
// `.`, `\` or `=` escaped with `\`. A path is always a list of unescaped segments.

import { isPlainObject } from "../json"

/** Escapes one segment so `formatPath` can join it back without changing its meaning. */
export function escapeSegment(segment: string): string {
	return segment.replace(/\\/g, "\\\\").replace(/\./g, "\\.").replace(/=/g, "\\=")
}

/** The canonical, caller-facing form of a path: escaped segments joined with dots. */
export function formatPath(segments: readonly string[]): string {
	return segments.map(escapeSegment).join(".")
}

/** Compares two paths segment by segment in UTF-16 code-unit order, so listings are total. */
export function comparePaths(a: readonly string[], b: readonly string[]): number {
	for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
		const left = a[index] ?? ""
		const right = b[index] ?? ""
		if (left !== right) return left < right ? -1 : 1
	}
	return a.length - b.length
}

/**
 * The problem's path in the Override grammar (ADR-0024): a list item is addressed by its unique
 * string `id`, never by index, and a list whose items have no unique id is cut back to the list's
 * own path, the only path a `--set` may replace there.
 */
export function overrideSegments(
	document: unknown,
	segments: readonly (string | number)[],
): readonly string[] {
	const resolved: string[] = []
	let current: unknown = document
	for (const segment of segments) {
		if (Array.isArray(current)) {
			const step = listStep(current, segment)
			if (step === null) return resolved
			resolved.push(step.id)
			current = step.item
			continue
		}
		resolved.push(String(segment))
		current = isPlainObject(current) ? current[String(segment)] : undefined
	}
	return resolved
}

type ListStep = { id: string; item: unknown }

/** The list item a numeric segment names, when its string `id` is unique in the list. */
function listStep(items: readonly unknown[], segment: string | number): ListStep | null {
	if (typeof segment !== "number") return null
	const item = items[segment]
	if (!isPlainObject(item)) return null
	const id = item["id"]
	if (typeof id !== "string" || countId(items, id) !== 1) return null
	return { id, item }
}

function countId(items: readonly unknown[], id: string): number {
	let seen = 0
	for (const item of items) {
		if (isPlainObject(item) && item["id"] === id) seen += 1
	}
	return seen
}
