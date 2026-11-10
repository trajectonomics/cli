// The dotted-path grammar shared by `scenario fork --set` and `scenario diff` (ADR-0024):
// object keys separated by dots, list items addressed by their stable string `id`, and a literal
// `.`, `\` or `=` escaped with `\`. A path is always a list of unescaped segments.

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
