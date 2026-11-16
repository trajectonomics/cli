import {
	codeSpans,
	lineAt,
	type Mention,
	markerAt,
	mentionsIn,
	type Section,
	sections,
} from "./readme"
import type { HelpNote, Mode, Problem, ReleaseFacts } from "./types"
import { newer, VERSION } from "./version"

/** The form a help note names a release in, so the freshness rule can read it. */
const NOTE_VERSION = new RegExp(`\\bships in (${VERSION})\\b`, "i")

/** True when some prefix of the words names a command the reader's release has. */
function resolves(words: readonly string[], known: ReadonlySet<string>): boolean {
	for (let end = words.length; end > 0; end--) {
		if (known.has(words.slice(0, end).join(" "))) return true
	}
	return false
}

function mentionProblem(
	facts: ReleaseFacts,
	all: readonly Section[],
	known: ReadonlySet<string>,
	mention: Mention,
): Problem | undefined {
	if (resolves(mention.words, known)) return undefined
	const marker = markerAt(all, mention.offset)
	if (marker !== undefined && newer(marker.version, facts.latestVersion)) return undefined
	const release = facts.latestVersion === undefined ? "" : ` (${facts.latestVersion})`
	return {
		code: "unreleased_command",
		line: mention.line,
		message: `\`traj ${mention.words.join(" ")}\` is not in the latest release${release} and is not inside a section marked "> **Ships in X.Y.Z.**". Mark the section with the release that ships it, or take the command out.`,
	}
}

function commandProblems(facts: ReleaseFacts, all: readonly Section[]): Problem[] {
	const known = new Set(facts.known)
	const problems: Problem[] = []
	for (const span of codeSpans(facts.readme)) {
		for (const mention of mentionsIn(facts.readme, span)) {
			const problem = mentionProblem(facts, all, known, mention)
			if (problem !== undefined) problems.push(problem)
		}
	}
	return problems
}

function markerProblem(section: Section, latest: string, readme: string): Problem | undefined {
	const marker = section.marker
	if (marker === undefined || newer(marker.version, latest)) return undefined
	return {
		code: "stale_marker",
		line: lineAt(readme, marker.at),
		message: `the marker "Ships in ${marker.version}" must name a release newer than the latest release (${latest}); remove the marker once its release has shipped.`,
	}
}

function noteProblem(note: HelpNote, latest: string): Problem | undefined {
	const version = NOTE_VERSION.exec(note.note)?.[1]
	if (version === undefined) {
		return {
			code: "stale_marker",
			message: `the note on \`traj ${note.command}\` names no release; write "ships in X.Y.Z".`,
		}
	}
	if (newer(version, latest)) return undefined
	return {
		code: "stale_marker",
		message: `the note on \`traj ${note.command}\` names ${version}, which is not newer than the latest release (${latest}); remove the note once its release has shipped.`,
	}
}

function freshnessProblems(facts: ReleaseFacts, all: readonly Section[]): Problem[] {
	const latest = facts.latestVersion
	if (latest === undefined) throw new Error("the freshness rule needs the latest release version")
	return [
		...all.flatMap((section) => markerProblem(section, latest, facts.readme) ?? []),
		...facts.notes.flatMap((note) => noteProblem(note, latest) ?? []),
	]
}

/**
 * Reports where the README and the help notes promise what the latest release cannot run, and, in
 * `freshness` mode, every marker or note that names a release at or before the latest one. The
 * README rule reads code spans and fences only: prose is not a command a reader copies.
 */
export function checkReleaseDocs(facts: ReleaseFacts, mode: Mode = "pull-request"): Problem[] {
	const all = sections(facts.readme)
	const problems = commandProblems(facts, all)
	if (mode === "freshness") problems.push(...freshnessProblems(facts, all))
	return problems.sort((a, b) => (a.line ?? 0) - (b.line ?? 0))
}
