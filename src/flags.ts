import type { z } from "zod"

export type FlagKind = "string" | "number" | "boolean"

/** One command-line flag, derived from one field of a command's input schema. */
export type FlagSpec = {
	field: string
	/** The kebab-case flag name without the leading dashes. */
	flag: string
	kind: FlagKind
	multiple: boolean
	required: boolean
	description: string | undefined
}

/** Flags every command accepts; an input field may not use these names. */
export const RESERVED_FLAGS: readonly string[] = ["json", "help", "version"]

export function toKebab(field: string): string {
	return field.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

const WRAPPERS = new Set(["optional", "default", "nullable", "readonly"])

/** Unwraps optional/default layers, remembering the first description found on the way. */
function unwrap(field: z.ZodType): { core: z.ZodType; description: string | undefined } {
	let core = field
	let description = field.description
	while (WRAPPERS.has(core.def.type)) {
		core = (core.def as unknown as { innerType: z.ZodType }).innerType
		description ??= core.description
	}
	return { core, description }
}

function kindOf(field: string, type: z.ZodType): FlagKind {
	const kind = type.def.type
	if (kind === "string" || kind === "number" || kind === "boolean") return kind
	// A closed set of string values is still a string flag; the schema validates the value.
	if (kind === "enum") return "string"
	throw new Error(`Input field "${field}" has type "${kind}", which cannot be a flag.`)
}

function flagOf(field: string, schema: z.ZodType, taken: Set<string>): FlagSpec {
	const { core, description } = unwrap(schema)
	const multiple = core.def.type === "array"
	const element = multiple ? (core.def as unknown as { element: z.ZodType }).element : core
	const flag = toKebab(field)
	if (RESERVED_FLAGS.includes(flag)) {
		throw new Error(`Input field "${field}" collides with the global --${flag} flag.`)
	}
	if (taken.has(flag)) throw new Error(`Two input fields map to the same flag --${flag}.`)
	taken.add(flag)
	return {
		field,
		flag,
		kind: kindOf(field, unwrap(element).core),
		multiple,
		required: !schema.safeParse(undefined).success,
		description,
	}
}

/** Derives the flags of an input schema: every field that is not a positional. */
export function deriveFlags(input: z.ZodObject, positionals: readonly string[]): FlagSpec[] {
	const catchall = input.def.catchall as z.ZodType | undefined
	if (catchall?.def.type !== "never") {
		throw new Error("A command input must be a strict object, so unknown fields are rejected.")
	}
	const taken = new Set<string>()
	return Object.entries(input.shape)
		.filter(([field]) => !positionals.includes(field))
		.map(([field, schema]) => flagOf(field, schema as z.ZodType, taken))
}

/** True when a positional field is an array: it takes every remaining word. */
export function isVariadic(input: z.ZodObject, name: string): boolean {
	const field = input.shape[name] as z.ZodType | undefined
	return field !== undefined && unwrap(field).core.def.type === "array"
}

function checkPositional(input: z.ZodObject, name: string, isLast: boolean): void {
	const field = input.shape[name] as z.ZodType | undefined
	if (!field) throw new Error(`Positional "${name}" is not a field of the input schema.`)
	const { core } = unwrap(field)
	const element =
		core.def.type === "array" ? (core.def as unknown as { element: z.ZodType }).element : core
	if (unwrap(element).core.def.type !== "string") {
		throw new Error(`Positional "${name}" must be a string or an array of strings.`)
	}
	if (isVariadic(input, name) && !isLast)
		throw new Error(`Variadic positional "${name}" must be last.`)
}

/** Fails at definition time if a positional is not a usable field. */
export function checkPositionals(input: z.ZodObject, positionals: readonly string[]): void {
	const repeated = positionals.find((name, index) => positionals.indexOf(name) !== index)
	if (repeated) throw new Error(`Positional "${repeated}" is listed twice.`)
	positionals.forEach((name, index) => {
		checkPositional(input, name, index === positionals.length - 1)
	})
}
