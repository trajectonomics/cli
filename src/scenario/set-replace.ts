import { type AppError, isAppError } from "../errors"
import { isPlainObject } from "../json"
import {
	ambiguousSegment,
	identityFailure,
	type SegmentContext,
	scalarPrefix,
	unknownSegment,
} from "./set-error"
import { candidatesAt } from "./set-suggest"

export type SetContext = SegmentContext & { value: unknown }

function matchesIn(node: readonly unknown[], segment: string): { item: unknown; at: number }[] {
	return node.flatMap((item, at) =>
		isPlainObject(item) && item["id"] === segment ? [{ item, at }] : [],
	)
}

function replaceInObject(
	node: Record<string, unknown>,
	segment: string,
	rest: number,
	prefix: readonly string[],
	ctx: SetContext,
): unknown | AppError {
	if (!Object.hasOwn(node, segment)) {
		return unknownSegment(candidatesAt(node), segment, rest, prefix, ctx)
	}
	const child = replaceAt(node[segment], rest, [...prefix, segment], ctx)
	return isAppError(child) ? child : { ...node, [segment]: child }
}

function replaceInList(
	node: readonly unknown[],
	segment: string,
	rest: number,
	prefix: readonly string[],
	ctx: SetContext,
): unknown | AppError {
	const matches = matchesIn(node, segment)
	const found = matches[0]
	if (found === undefined) return unknownSegment(candidatesAt(node), segment, rest, prefix, ctx)
	if (matches.length > 1) return ambiguousSegment(segment, prefix, ctx)
	const child = replaceAt(found.item, rest, [...prefix, segment], ctx)
	if (isAppError(child)) return child
	// Whatever the depth, the item's own identity may not be rewritten through a value.
	if (!isPlainObject(child) || child["id"] !== segment) return identityFailure(segment, ctx)
	return node.map((item, at) => (at === found.at ? child : item))
}

/** Replaces exactly one existing path, copying only the nodes on the way. */
export function replaceAt(
	node: unknown,
	depth: number,
	prefix: readonly string[],
	ctx: SetContext,
): unknown | AppError {
	const segment = ctx.segments[depth]
	if (segment === undefined) return ctx.value
	const rest = depth + 1
	if (isPlainObject(node)) return replaceInObject(node, segment, rest, prefix, ctx)
	if (Array.isArray(node)) return replaceInList(node, segment, rest, prefix, ctx)
	return scalarPrefix(prefix, ctx)
}
