import type { AppError } from "../errors"
import { documentPath, overrideSegments, type ScenarioProblem } from "./document"
import { formatPath } from "./path"
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

/** The error for a document the overrides left outside `sim-core`'s Scenario schema, at a set. */
export function documentFailure(
	overrides: readonly AppliedOverride[],
	problem: ScenarioProblem,
	document: unknown,
): AppError {
	const segments = overrideSegments(document, problem.segments)
	const failing = formatPath(segments)
	const prefixes = new Set(segments.map((_, index) => formatPath(segments.slice(0, index + 1))))
	let index = -1
	for (const [at, override] of overrides.entries()) {
		if (prefixes.has(override.path)) index = at
	}
	if (index === -1) index = Math.max(0, overrides.length - 1)
	const selected = overrides[index]
	const path = documentPath("document", problem.segments)
	return badSet(index, `the document is invalid after the overrides: ${path}: ${problem.code}`, {
		hint: `The overrides leave ${path} invalid; change that value or the path.`,
		details: { index, path: selected?.path ?? failing, documentPath: path, code: problem.code },
	})
}
