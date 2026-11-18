import type { Group, Leaf, Node } from "./command"
import { documentOnly, documentUsage } from "./document-usage"
import { exitUsage } from "./exit-usage"
import { sortedByName } from "./tree"
import { flagLabel, flagNote, positionalLabel, table } from "./usage-labels"

const GLOBAL_OPTIONS: readonly (readonly [string, string])[] = [
	["--json", "Print JSON; errors become a JSON envelope on stderr"],
	["-h, --help", "Show usage"],
	["-v, --version", "Print the version"],
]

const ENVIRONMENT: readonly (readonly [string, string])[] = [
	["TRAJ_FORMAT", "human (default) or json; --json takes precedence"],
	["TRAJ_HOME", "Data directory (default ~/.traj)"],
	["TRAJ_DEBUG", "Set to 1 to print diagnostics for unexpected errors"],
]

function groupUsage(group: Group, path: readonly string[]): string {
	const rows = sortedByName(group.children).map((child) => [child.name, child.summary] as const)
	const isRoot = path.length === 0
	return [
		`Usage: traj ${[...path, "<command>"].join(" ")} [options]`,
		...(isRoot ? [] : ["", group.summary, ...(group.note === undefined ? [] : ["", group.note])]),
		"",
		"Commands:",
		...table(rows),
		...(isRoot
			? [
					...exitUsage(),
					"",
					"Options:",
					...table(GLOBAL_OPTIONS),
					"",
					"Environment:",
					...table(ENVIRONMENT),
				]
			: []),
	].join("\n")
}

function leafUsage(leaf: Leaf, path: readonly string[]): string {
	const words = leaf.positionals.map((name) => positionalLabel(leaf, name))
	const alternate = documentUsage(leaf, path)
	// A document-only leaf has no flag form of its own, so the alternate line is its one usage.
	const single = alternate !== undefined && documentOnly(leaf)
	const flags = leaf.flags.length > 0 && !single ? ["[options]"] : []
	const own = leaf.flags.map((spec) => [flagLabel(spec), flagNote(spec)] as const)
	const examples = leaf.examples.map((example) => [example.command, example.description] as const)
	const usage = single
		? [alternate]
		: [
				`Usage: traj ${[...path, ...flags, ...words].join(" ")}`,
				...(alternate === undefined ? [] : [alternate]),
			]
	return [
		...usage,
		"",
		leaf.summary,
		...(leaf.note === undefined ? [] : ["", leaf.note]),
		...(own.length > 0 ? ["", "Options:", ...table(own)] : []),
		"",
		"Global options:",
		...table(GLOBAL_OPTIONS),
		...(examples.length > 0 ? ["", "Examples:", ...table(examples)] : []),
	].join("\n")
}

/** The usage text of a node, built from its schemas so it cannot drift from what is accepted. */
export function usageOf(node: Node, path: readonly string[]): string {
	return node.kind === "group" ? groupUsage(node, path) : leafUsage(node, path)
}
