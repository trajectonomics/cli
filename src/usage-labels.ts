import type { z } from "zod"
import type { Leaf } from "./command"
import { type FlagSpec, isVariadic } from "./flags"

export function table(rows: readonly (readonly [string, string])[]): string[] {
	const width = Math.max(0, ...rows.map(([left]) => left.length))
	return rows.map(([left, right]) => `  ${left.padEnd(width)}  ${right}`.trimEnd())
}

export function flagLabel(spec: FlagSpec): string {
	return spec.kind === "boolean" ? `--${spec.flag}` : `--${spec.flag} <${spec.kind}>`
}

export function flagNote(spec: FlagSpec): string {
	const notes = [spec.description?.replace(/\.$/, ""), spec.multiple ? "repeatable" : undefined]
	if (spec.required) notes.push("required")
	return notes.filter(Boolean).join("; ")
}

/** `<word>` when required, `[word]` when optional, `[word...]` when it takes the rest. */
export function positionalLabel(leaf: Leaf, name: string): string {
	const field = leaf.input.shape[name] as z.ZodType
	const dots = isVariadic(leaf.input, name) ? "..." : ""
	return field.safeParse(undefined).success ? `[${name}${dots}]` : `<${name}${dots}>`
}
