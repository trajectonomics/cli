/**
 * A help page's release note: the command path it belongs to, and the sentence it prints. It is
 * reader-facing prose, so it never reaches `traj schema` (ADR-0034).
 */
export type HelpNote = { readonly command: string; readonly note: string }

/**
 * What a release-docs check knows. `known` is the set of command paths a line may name without a
 * marker: the latest release's own paths online, this tree's paths offline. `latestVersion` is
 * absent offline, where no marker has to beat a release.
 */
export type ReleaseFacts = {
	readonly readme: string
	readonly known: readonly string[]
	readonly latestVersion?: string
	readonly notes: readonly HelpNote[]
}

/** The two disagreements: a command no release has, and a marker its release outlived. */
export type ProblemCode = "unreleased_command" | "stale_marker"

/** One reason a document and a release disagree. `line` is 1-based and absent outside the README. */
export type Problem = {
	readonly code: ProblemCode
	readonly line?: number
	readonly message: string
}

/** A pull request is failed only on the drift it introduces; the weekly run adds freshness. */
export type Mode = "pull-request" | "freshness"
