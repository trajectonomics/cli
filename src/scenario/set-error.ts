import type { AppError } from "../errors"
import { documentPath, type ScenarioProblem } from "./document"
import { formatPath, overrideSegments } from "./path"
import { badSet } from "./set-parse"
import { closeEnough, knownPaths, nearest } from "./set-suggest"

export type AppliedOverride = { path: string; value: unknown }

export type SegmentContext = {
	index: number
	path: string
	segments: readonly string[]
}

/** The first segment that cannot be followed, with the nearest path or the known siblings. */
export function unknownSegment(
	candidates: readonly string[],
	segment: string,
	rest: number,
	prefix: readonly string[],
	ctx: SegmentContext,
): AppError {
	const closest = nearest(segment, candidates)
	const suggestion =
		closest !== null && closeEnough(closest)
			? formatPath([...prefix, closest.candidate, ...ctx.segments.slice(rest)])
			: null
	const where = prefix.length === 0 ? "the document" : `"${formatPath(prefix)}"`
	const hint =
		suggestion !== null
			? `Did you mean "${suggestion}"?`
			: candidates.length === 0
				? `There is no key or id under ${where}.`
				: knownPaths(candidates)
	return badSet(ctx.index, `no key or id "${segment}" under ${where}`, {
		hint,
		details: { index: ctx.index, path: ctx.path, segment, suggestion },
	})
}

export function ambiguousSegment(
	segment: string,
	prefix: readonly string[],
	ctx: SegmentContext,
): AppError {
	return badSet(ctx.index, `"${segment}" matches more than one id under "${formatPath(prefix)}"`, {
		hint: "Address a list item by an id that appears once.",
		details: { index: ctx.index, path: ctx.path, segment },
	})
}

export function scalarPrefix(prefix: readonly string[], ctx: SegmentContext): AppError {
	const where = prefix.length === 0 ? "the document" : `"${formatPath(prefix)}"`
	return badSet(ctx.index, `${where} is not an object, so it cannot be walked into`, {
		hint: `"${formatPath(prefix)}" is a value; set it whole, or choose a path under an object.`,
		details: { index: ctx.index, path: ctx.path, segment: formatPath(prefix), suggestion: null },
	})
}

export function identityFailure(segment: string, ctx: SegmentContext): AppError {
	return badSet(ctx.index, `the item "${segment}" must stay an object with id "${segment}"`, {
		hint: "Replacing a list item may change its fields, never its id.",
		details: { index: ctx.index, path: ctx.path, segment },
	})
}

/**
 * The Set whose path covers a problem: the last in command-line order when several do, `-1` when
 * none does.
 */
function matchingSet(
	overrides: readonly AppliedOverride[],
	problem: ScenarioProblem,
	document: unknown,
): number {
	const segments = overrideSegments(document, problem.segments)
	const prefixes = new Set(segments.map((_, index) => formatPath(segments.slice(0, index + 1))))
	let found = -1
	for (const [index, override] of overrides.entries()) {
		if (prefixes.has(override.path)) found = index
	}
	return found
}

/**
 * The error for a document the overrides left outside `sim-core`'s Scenario schema, at a Set. It
 * reports the first problem a Set covers, so a later problem cannot hide the one that names the
 * cause; when no Set covers a problem it reports the first and falls back to the last Set.
 */
export function documentFailure(
	overrides: readonly AppliedOverride[],
	problems: readonly [ScenarioProblem, ...ScenarioProblem[]],
	document: unknown,
): AppError {
	const candidates = problems.map((problem) => ({
		problem,
		match: matchingSet(overrides, problem, document),
	}))
	const chosen = candidates.find((candidate) => candidate.match !== -1) ?? candidates[0]
	if (chosen === undefined) throw new Error("a document failure needs at least one problem")
	const index = chosen.match === -1 ? Math.max(0, overrides.length - 1) : chosen.match
	const selected = overrides[index]
	const path = documentPath("document", chosen.problem.segments)
	return badSet(
		index,
		`the document is invalid after the overrides: ${path}: ${chosen.problem.code}`,
		{
			hint: `The overrides leave ${path} invalid; change that value or the path.`,
			details: {
				index,
				path: selected?.path ?? formatPath(overrideSegments(document, chosen.problem.segments)),
				documentPath: path,
				code: chosen.problem.code,
			},
		},
	)
}
