import type { z } from "zod"
import type { Group, Leaf, Node } from "./command"
import { type FlagSpec, isVariadic } from "./flags"
import { sortedByName } from "./tree"

function table(rows: readonly (readonly [string, string])[]): string[] {
	const width = Math.max(0, ...rows.map(([left]) => left.length))
	return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`.trimEnd())
}

function flagLabel(spec: FlagSpec): string {
	return spec.kind === "boolean" ? `--${spec.flag}` : `--${spec.flag} <${spec.kind}>`
}

function flagNote(spec: FlagSpec): string {
	const notes = [spec.description?.replace(/\.$/, ""), spec.multiple ? "repeatable" : undefined]
	if (spec.required) notes.push("required")
	return notes.filter(Boolean).join("; ")
}

/** `<word>` when required, `[word]` when optional, `[word...]` when it takes the rest. */
function positionalLabel(leaf: Leaf, name: string): string {
	const field = leaf.input.shape[name] as z.ZodType
	const dots = isVariadic(leaf.input, name) ? "..." : ""
	return field.safeParse(undefined).success ? `[${name}${dots}]` : `<${name}${dots}>`
}

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
		...(isRoot ? [] : ["", group.summary]),
		"",
		"Commands:",
		...table(rows),
		...(isRoot
			? ["", "Options:", ...table(GLOBAL_OPTIONS), "", "Environment:", ...table(ENVIRONMENT)]
			: []),
	].join("\n")
}

function documentUsage(leaf: Leaf, path: readonly string[]): string | undefined {
	const document = leaf.document
	if (document === undefined) return undefined
	const flag = leaf.flags.find((spec) => spec.field === document.flag)
	if (flag === undefined) return undefined
	const allowed = (document.allowed ?? []).flatMap((field) => {
		const spec = leaf.flags.find((candidate) => candidate.field === field)
		return spec === undefined ? [] : [`[${flagLabel(spec)}]`]
	})
	const file = flagLabel(flag).replace("<string>", "<file|->")
	const words = leaf.positionals.map((name) => positionalLabel(leaf, name))
	return `Usage: traj ${[...path, ...words, file, ...allowed].join(" ")}`
}

/** True when every flag is the document flag or one it allows: one usage line says it all. */
function documentOnly(leaf: Leaf): boolean {
	const document = leaf.document
	if (document === undefined) return false
	const keep = new Set([document.flag, ...(document.allowed ?? [])])
	return leaf.flags.every((spec) => keep.has(spec.field))
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
