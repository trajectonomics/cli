import { acceptedScenarioSchemaVersion, scenarioProblems } from "../document"
import { scenarioShapeProperties } from "./index"

/*
 * How the shape tests read the published schema: as paths, so one assertion can hold for every key
 * the document states. They walk `properties` and reach an array's own items as `*`, which is the
 * one path segment that is not a key.
 */

export const VERSION: number | undefined = acceptedScenarioSchemaVersion()
export const PROPERTIES: Record<string, unknown> = scenarioShapeProperties(VERSION)

export type Schema = Record<string, unknown>

/** A path inside a document; a number indexes an array, and `*` means every item of one. */
export type Path = (string | number)[]

/** One documented schema node and the path that reaches it. */
export type Documented = { path: Path; node: Schema }

/** The paths inside one node: its own properties, or an array's own items. */
function inside(node: Schema, at: Path): Documented[] {
	const properties = documented(node, at)
	if (properties.length > 0) return properties
	const items = node["items"] as Schema | undefined
	if (items === undefined) return []
	const itemPath: Path = [...at, "*"]
	return [{ path: itemPath, node: items }, ...documented(items, itemPath)]
}

/** Every property path the published schema states, with array items reached as `*`. */
export function documented(node: Schema = { properties: PROPERTIES }, at: Path = []): Documented[] {
	const found: Documented[] = []
	for (const [key, child] of Object.entries((node["properties"] ?? {}) as Record<string, Schema>)) {
		const path = [...at, key]
		found.push({ path, node: child }, ...inside(child, path))
	}
	return found
}

/** The schema node at `path`, where a `*` or an index reaches an array's items. */
export function nodeAt(path: Path): Schema {
	let node: Schema = { properties: PROPERTIES }
	for (const segment of path) {
		node =
			segment === "*" || typeof segment === "number"
				? (node["items"] as Schema)
				: ((node["properties"] as Record<string, Schema>)[segment] as Schema)
	}
	return node
}

/** Whether any item a `*` reaches carries the rest of `path`: the document states that path. */
export function resolves(value: unknown, path: Path): boolean {
	if (path.length === 0) return value !== undefined
	const [head, ...rest] = path
	if (head === "*") return (Array.isArray(value) ? value : []).some((item) => resolves(item, rest))
	return typeof value === "object" && value !== null
		? resolves((value as Schema)[head as string], rest)
		: false
}

/** A document with one path replaced, so a probe changes one field and nothing else. */
export function replaceAt(document: unknown, path: Path, set: unknown): unknown {
	if (path.length === 0) return set
	const [head, ...rest] = path
	const container = (
		Array.isArray(document) ? [...document] : { ...(document as Schema) }
	) as Schema
	container[head as string] = replaceAt((document as Schema)[head as string], rest, set)
	return container
}

/** The refusals a document draws, each path segment joined by dots. */
export function refusalsOf(document: unknown): { code: string; path: string }[] {
	return scenarioProblems(document).map((problem) => ({
		code: problem.code,
		path: problem.segments.map(String).join("."),
	}))
}

/** The path as the core spells it, every index written out. */
export function probed(path: Path): string {
	return path.map((segment) => (segment === "*" ? "0" : segment)).join(".")
}

/** The path with every index folded back into `*`, so a documented path and a probe compare. */
export function canonical(path: Path): string {
	return path.map((segment) => (typeof segment === "number" ? "*" : segment)).join(".")
}
