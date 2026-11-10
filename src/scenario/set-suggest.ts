import { isPlainObject } from "../json"
import { escapeSegment } from "./path"

function levenshtein(a: string, b: string): number {
	let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
	for (let row = 1; row <= a.length; row += 1) {
		const current = [row]
		for (let column = 1; column <= b.length; column += 1) {
			const cost = a[row - 1] === b[column - 1] ? 0 : 1
			current.push(
				Math.min(
					(current[column - 1] ?? 0) + 1,
					(previous[column] ?? 0) + 1,
					(previous[column - 1] ?? 0) + cost,
				),
			)
		}
		previous = current
	}
	return previous[b.length] ?? 0
}

export function nearest(
	segment: string,
	candidates: readonly string[],
): { candidate: string; distance: number } | null {
	let best: { candidate: string; distance: number } | null = null
	for (const candidate of candidates) {
		const distance = levenshtein(segment, candidate)
		const closer =
			best === null ||
			distance < best.distance ||
			(distance === best.distance && candidate < best.candidate)
		if (closer) best = { candidate, distance }
	}
	return best
}

/** True when the nearest candidate is close enough to print as a corrected path. */
export function closeEnough(nearest: { candidate: string; distance: number }): boolean {
	return nearest.distance <= Math.max(2, Math.floor(nearest.candidate.length / 3))
}

export function knownPaths(candidates: readonly string[]): string {
	const sorted = [...candidates].sort()
	const shown = sorted.slice(0, 10).map((candidate) => `"${escapeSegment(candidate)}"`)
	const more = sorted.length > shown.length ? `, and ${sorted.length - shown.length} more` : ""
	return `Known paths here: ${shown.join(", ")}${more}.`
}

/** The keys of an object, or the unique string ids of a list, at one level. */
export function candidatesAt(node: unknown): string[] {
	if (isPlainObject(node)) return Object.keys(node)
	if (!Array.isArray(node)) return []
	const ids = node.flatMap((item) =>
		isPlainObject(item) && typeof item["id"] === "string" ? [item["id"]] : [],
	)
	return [...new Set(ids)]
}
