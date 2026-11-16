/** `X.Y.Z`: the only form a release, a marker or a help note names a version in (ADR-0034). */
export const VERSION = "\\d+\\.\\d+\\.\\d+"

function parts(version: string): number[] {
	return version.split(".").map(Number)
}

/** Compares two `X.Y.Z` versions, negative when `a` comes first. */
function compare(a: readonly number[], b: readonly number[]): number {
	return (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0) || (a[2] ?? 0) - (b[2] ?? 0)
}

/** True when `version` names a release after `latest`, and when there is no release to beat. */
export function newer(version: string, latest: string | undefined): boolean {
	return latest === undefined || compare(parts(version), parts(latest)) > 0
}
