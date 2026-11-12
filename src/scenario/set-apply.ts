import { type AppError, isAppError } from "../errors"
import { isPlainObject } from "../json"
import { type ScenarioDocument, scenarioProblems } from "./document"
import { formatPath } from "./path"
import { type AppliedOverride, documentFailure } from "./set-error"
import { badSet, type ParsedSet, parseSet } from "./set-parse"
import { replaceAt } from "./set-replace"

/** The document a fork persists, and the overrides that produced it, in command-line order. */
export type AppliedOverrides = { document: ScenarioDocument; overrides: AppliedOverride[] }

function parseSets(sets: readonly string[]): ParsedSet[] | AppError {
	const parsed: ParsedSet[] = []
	for (const [index, raw] of sets.entries()) {
		const set = parseSet(raw, index)
		if (isAppError(set)) return set
		parsed.push(set)
	}
	return parsed
}

function duplicatePath(parsed: readonly ParsedSet[]): AppError | null {
	const seen = new Set<string>()
	for (const [index, set] of parsed.entries()) {
		const path = formatPath(set.segments)
		if (seen.has(path)) {
			return badSet(index, `the path "${path}" is given twice`, {
				hint: "Each --set path may appear once; later sets already see earlier ones.",
				details: { index, path },
			})
		}
		seen.add(path)
	}
	return null
}

/**
 * Parses and applies `--set` strings to a Scenario document, in command-line order, as one pure
 * function (ADR-0024). It never mutates its input: each change copies the nodes on its path.
 */
export function applyOverrides(
	document: ScenarioDocument,
	sets: readonly string[],
): AppliedOverrides | AppError {
	if (sets.length === 0) return { document, overrides: [] }
	const parsed = parseSets(sets)
	if (isAppError(parsed)) return parsed
	const duplicate = duplicatePath(parsed)
	if (duplicate !== null) return duplicate
	let current = document
	const overrides: AppliedOverride[] = []
	for (const [index, set] of parsed.entries()) {
		const path = formatPath(set.segments)
		const next = replaceAt(current, 0, [], {
			index,
			path,
			segments: set.segments,
			value: set.value,
		})
		if (isAppError(next)) return next
		if (!isPlainObject(next)) throw new Error("an override replaced the document itself")
		current = next
		overrides.push({ path, value: set.value })
	}
	return { document: current, overrides }
}

/**
 * Applies the Sets and refuses a final document `sim-core` does not accept, reported at the Set at
 * fault. The pre-check lives beside `applyOverrides` so a caller cannot forget it (ADR-0024).
 */
export function applyScenarioSets(
	document: ScenarioDocument,
	sets: readonly string[],
): AppliedOverrides | AppError {
	if (sets.length === 0) return { document, overrides: [] }
	const applied = applyOverrides(document, sets)
	if (isAppError(applied)) return applied
	const [first, ...rest] = scenarioProblems(applied.document)
	if (first === undefined) return applied
	return documentFailure(applied.overrides, [first, ...rest], applied.document)
}
