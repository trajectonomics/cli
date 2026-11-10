import { isPlainObject } from "../json"
import { bothIdKeyed, commonIds, deepEqual, type Item, idOf, mapById } from "./diff-equal"
import { comparePaths, formatPath } from "./path"

export type ChangeKind = "added" | "removed" | "changed"

/** One structural change between two documents, on the shared dotted-path form. */
export type Change = { path: string; kind: ChangeKind; before?: unknown; after?: unknown }

type RawChange = { segments: string[]; kind: ChangeKind; before?: unknown; after?: unknown }

function walkList(a: Item, b: Item, segments: string[], changes: RawChange[]): void {
	const aById = mapById(a)
	const bById = mapById(b)
	// Order may be semantic, so a reorder is one list-level change, never per-item noise.
	const reordered = commonIds(a, bById).join("\u0000") !== commonIds(b, aById).join("\u0000")
	if (reordered) {
		changes.push({ segments, kind: "changed", before: a, after: b })
		return
	}
	for (const item of a) {
		const id = idOf(item)
		const after = bById.get(id)
		if (after === undefined) {
			changes.push({ segments: [...segments, id], kind: "removed", before: item })
		} else {
			walk(item, after, [...segments, id], changes)
		}
	}
	for (const item of b) {
		const id = idOf(item)
		if (!aById.has(id)) changes.push({ segments: [...segments, id], kind: "added", after: item })
	}
}

function walkObjects(
	a: Record<string, unknown>,
	b: Record<string, unknown>,
	segments: string[],
	changes: RawChange[],
): void {
	for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
		const inA = Object.hasOwn(a, key)
		const inB = Object.hasOwn(b, key)
		if (inA && inB) {
			walk(a[key], b[key], [...segments, key], changes)
		} else if (inA) {
			changes.push({ segments: [...segments, key], kind: "removed", before: a[key] })
		} else {
			changes.push({ segments: [...segments, key], kind: "added", after: b[key] })
		}
	}
}

function walk(a: unknown, b: unknown, segments: string[], changes: RawChange[]): void {
	if (deepEqual(a, b)) return
	if (isPlainObject(a) && isPlainObject(b)) {
		walkObjects(a, b, segments, changes)
		return
	}
	if (bothIdKeyed(a, b)) {
		walkList(a as Item, b as Item, segments, changes)
		return
	}
	// Anything else is one atomic value: a list without ids, an empty side, or a scalar.
	changes.push({ segments, kind: "changed", before: a, after: b })
}

function publicChange(change: RawChange): Change {
	const path = formatPath(change.segments)
	if (change.kind === "added") return { path, kind: "added", after: change.after }
	if (change.kind === "removed") return { path, kind: "removed", before: change.before }
	return { path, kind: "changed", before: change.before, after: change.after }
}

/** The structured difference between two Scenario documents (ADR-0024), in path order. */
export function diffDocuments(a: unknown, b: unknown): Change[] {
	const changes: RawChange[] = []
	walk(a, b, [], changes)
	return changes
		.sort((left, right) => comparePaths(left.segments, right.segments))
		.map(publicChange)
}
