import type { z } from "zod"
import type { AppError, ErrorCode } from "./errors"
import { checkPositionals, deriveFlags, type FlagSpec } from "./flags"
import type { RenderHint } from "./table"

export type Env = Readonly<Record<string, string | undefined>>

/** What a command returns on success: structure only. The envelope layer renders it. */
export type Result<T = unknown> = { readonly ok: true; readonly data: T }

export function ok<T>(data: T): Result<T> {
	return { ok: true, data }
}

export type Example = { command: string; description: string }

/** What a running command may read from the outside world. */
export type Context = {
	env: Env
	root: Group
	/** Reads all of stdin; only a form that names `-` calls it: a document form, or `tx import -`. */
	stdin: () => Promise<string>
}

/**
 * A leaf's second input form: a JSON document named by `flag` (a path, or `-` for stdin). The
 * document schema is a shape of its own; `allowed` names the flags that may accompany it, and
 * every other input field is exclusive to the flag form (ADR-0020).
 */
export type DocumentSpec<D extends z.ZodType = z.ZodType> = {
	flag: string
	schema: D
	allowed?: readonly string[]
}

type Outcome<T> = Result<T> | AppError | Promise<Result<T> | AppError>

/** A command's run arguments: the document is present only when the leaf declares one. */
type RunArgs<I extends z.ZodObject, D extends z.ZodType | undefined> = D extends z.ZodType
	? [input: z.output<I>, document: z.output<D>, ctx: Context]
	: [input: z.output<I>, ctx: Context]

/**
 * A leaf command carries its summary, the schema that validates its input, the schema its result
 * must satisfy, and the function that produces that result. It never formats and never exits.
 * Flags are derived from the input schema: every field that is not a positional is a flag.
 */
export type Command<
	I extends z.ZodObject,
	O extends z.ZodType,
	D extends z.ZodType | undefined = undefined,
> = {
	name: string
	summary: string
	/** Input fields filled from positional words, in order. The last may be an array. */
	positionals: readonly string[]
	input: I
	/**
	 * The alternate document form, beside the flag form (ADR-0020). The flag form's input schema
	 * stays the single source of flags, `required` and usage.
	 */
	document?: DocumentSpec<NonNullable<D>>
	output: O
	examples: readonly Example[]
	/** How a table-shaped result renders in the human Format; JSON ignores it. */
	render?: RenderHint
	/** Codes this command raises itself. Global codes such as `unknown_flag` are not listed. */
	errorCodes: readonly ErrorCode[]
	run: (...args: RunArgs<I, D>) => Outcome<z.input<O>>
}

/** A leaf with its schema types erased and its flags derived, for the command tree. */
export type Leaf = {
	kind: "leaf"
	name: string
	summary: string
	positionals: readonly string[]
	input: z.ZodObject
	document?: DocumentSpec
	output: z.ZodType
	flags: readonly FlagSpec[]
	examples: readonly Example[]
	render?: RenderHint
	errorCodes: readonly ErrorCode[]
	run: (input: unknown, document: unknown, ctx: Context) => Outcome<unknown>
}

/** A named set of subcommands. It has no `run` of its own: bare `traj tx` prints its usage. */
export type Group = {
	kind: "group"
	name: string
	summary: string
	children: readonly Node[]
}

export type Node = Leaf | Group

/** Keeps the schema types checked against `run`, then erases them for the tree. */
export function defineCommand<
	I extends z.ZodObject,
	O extends z.ZodType,
	D extends z.ZodType | undefined = undefined,
>(command: Command<I, O, D>): Leaf {
	checkPositionals(command.input, command.positionals)
	checkDocument(command.input, command.document)
	const flags = deriveFlags(command.input, command.positionals)
	// A command without a document form takes (input, ctx); the leaf's call site always passes
	// the document slot, so adapt the two shapes here, once, where the types are still known.
	const run =
		command.document === undefined
			? (input: unknown, _document: unknown, ctx: Context) =>
					(command.run as unknown as (input: unknown, ctx: Context) => Outcome<unknown>)(input, ctx)
			: (command.run as unknown as Leaf["run"])
	return { kind: "leaf", ...command, run, flags } as unknown as Leaf
}

/** Fails at definition time if the document form names a field that is not a flag. */
function checkDocument(input: z.ZodObject, document: DocumentSpec | undefined): void {
	if (document === undefined) return
	if (!(document.flag in input.shape)) {
		throw new Error(`Document flag "${document.flag}" is not a field of the input schema.`)
	}
	for (const field of document.allowed ?? []) {
		if (!(field in input.shape)) {
			throw new Error(`Document field "${field}" is not a field of the input schema.`)
		}
	}
}

export function defineGroup(group: Omit<Group, "kind">): Group {
	const names = group.children.map((child) => child.name)
	const hidden = names.find((name) => name.startsWith("-") || name === "")
	if (hidden !== undefined) throw new Error(`Child name "${hidden}" could never be reached.`)
	const duplicate = names.find((name, index) => names.indexOf(name) !== index)
	if (duplicate) throw new Error(`Group "${group.name}" has two children named "${duplicate}".`)
	return { kind: "group", ...group }
}
