import { VERSION } from "./version"

/** A stretch of the README: a fenced block, an inline code span, or a `## ` section. */
export type Span = { readonly start: number; readonly end: number }

/** A `## ` section and the marker that covers it, with everything before that marker uncovered. */
export type Section = {
	readonly end: number
	readonly marker?: { readonly version: string; readonly at: number }
}

/** A `traj <words>` mention: the command words that follow it, where it sits, and its line. */
export type Mention = {
	readonly words: readonly string[]
	readonly offset: number
	readonly line: number
}

/** The visible first line of a section's marker, as ADR-0034 writes it. */
const MARKER = new RegExp(`^> \\*\\*Ships in (${VERSION})\\.\\*\\*`, "m")

/** `traj` as a command word, not as the tail of a path such as `dist/traj` or `~/.traj/bin`. */
const TRAJ = /(?<![\w./\\-])traj(?![\w-])/g

/** The deepest command path this tree may grow to; a longer line stops at this many words. */
const MAX_DEPTH = 3

export function lineAt(text: string, offset: number): number {
	return text.slice(0, offset).split("\n").length
}

/** The fenced blocks, paired by their ``` fences, in order. */
function fences(readme: string): Span[] {
	const spans: Span[] = []
	let open: number | undefined
	let offset = 0
	for (const line of readme.split("\n")) {
		const end = offset + line.length
		if (line.trimStart().startsWith("```")) {
			if (open === undefined) {
				open = offset
			} else {
				spans.push({ start: open, end })
				open = undefined
			}
		}
		offset = end + 1
	}
	if (open !== undefined) spans.push({ start: open, end: readme.length })
	return spans
}

/** Blanks out spans that are already known, keeping every offset where it was. */
function blank(text: string, spans: readonly Span[]): string {
	return spans.reduceRight(
		(rest, span) =>
			rest.slice(0, span.start) + " ".repeat(span.end - span.start) + rest.slice(span.end),
		text,
	)
}

/** Inline code spans, found outside the fences so a fence's backticks cannot open one. */
function inlineSpans(readme: string, fenced: readonly Span[]): Span[] {
	const spans: Span[] = []
	for (const match of blank(readme, fenced).matchAll(/`[^`\n]+`/g)) {
		if (match.index === undefined) continue
		spans.push({ start: match.index, end: match.index + match[0].length })
	}
	return spans
}

/** Every fenced block and inline code span: where a reader copies a command from. */
export function codeSpans(readme: string): Span[] {
	const fenced = fences(readme)
	return [...fenced, ...inlineSpans(readme, fenced)].sort((a, b) => a.start - b.start)
}

/** `## ` sections, the unit a marker covers: it ends at the next heading of the same level. */
export function sections(readme: string): Section[] {
	const starts = [...readme.matchAll(/^## [^\n]*$/gm)].flatMap((match) =>
		match.index === undefined ? [] : [match.index],
	)
	return starts.map((start) => {
		const body = readme.slice(start, starts.find((candidate) => candidate > start) ?? readme.length)
		const marker = MARKER.exec(body)
		const version = marker?.[1]
		const at = marker?.index
		return {
			end: start + body.length,
			...(version === undefined || at === undefined ? {} : { marker: { version, at: start + at } }),
		}
	})
}

/** The leading command words of a line, so `traj scenario tax <name>` yields two. */
function commandWords(after: string): string[] {
	const words: string[] = []
	for (const token of after.split(/\s+/)) {
		// A word may carry the span's closing backtick or a sentence's comma; take the name only.
		const word = /^[a-z][a-z0-9-]*/.exec(token)?.[0]
		if (word === undefined || words.length === MAX_DEPTH) break
		words.push(word)
	}
	return words
}

/** The `traj <words>` mentions inside one span, with the command words that follow on its line. */
export function mentionsIn(readme: string, span: Span): Mention[] {
	const text = readme.slice(span.start, span.end)
	const mentions: Mention[] = []
	for (const match of text.matchAll(TRAJ)) {
		if (match.index === undefined) continue
		const at = span.start + match.index
		const after = text.slice(match.index + match[0].length).split("\n")[0] ?? ""
		const words = commandWords(after.trimStart())
		if (words.length === 0) continue
		mentions.push({ words, offset: at, line: lineAt(readme, at) })
	}
	return mentions
}

/** The marker covering an offset: in its section, at or after the marker line. */
export function markerAt(all: readonly Section[], offset: number): Section["marker"] {
	return all.find(
		(section) =>
			offset < section.end && section.marker !== undefined && offset >= section.marker.at,
	)?.marker
}
