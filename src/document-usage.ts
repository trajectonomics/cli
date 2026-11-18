import type { Leaf } from "./command"
import { flagLabel, positionalLabel } from "./usage-labels"

export function documentUsage(leaf: Leaf, path: readonly string[]): string | undefined {
	const document = leaf.document
	if (document === undefined) return undefined
	const flag = leaf.flags.find((spec) => spec.field === document.flag)
	if (flag === undefined) return undefined
	const required = new Set((document.required ?? []).map((entry) => entry.field))
	const allowed = (document.allowed ?? []).flatMap((field) => {
		const spec = leaf.flags.find((candidate) => candidate.field === field)
		if (spec === undefined) return []
		const label = flagLabel(spec)
		return [required.has(field) ? label : `[${label}]`]
	})
	const file = flagLabel(flag).replace("<string>", "<file|->")
	// A field the document form requires stays `<name>` even though the flag form made it optional.
	const words = leaf.positionals.map((name) =>
		required.has(name) ? `<${name}>` : positionalLabel(leaf, name),
	)
	return `Usage: traj ${[...path, ...words, file, ...allowed].join(" ")}`
}

/** True when every flag is the document flag or one it allows: one usage line says it all. */
export function documentOnly(leaf: Leaf): boolean {
	const document = leaf.document
	if (document === undefined) return false
	const keep = new Set([document.flag, ...(document.allowed ?? [])])
	return leaf.flags.every((spec) => keep.has(spec.field))
}
