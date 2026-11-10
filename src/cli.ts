import type { Context, Env, Group, Leaf } from "./command"
import { root as defaultRoot } from "./commands"
import { type AppError, fail, isAppError } from "./errors"
import { parseInput } from "./input"
import { parseNodeArgs } from "./parse"
import { type Format, renderError, renderResult, resolveFormat } from "./render"
import type { RenderHint } from "./table"
import { findNode, unknownCommand, walk } from "./tree"

export interface Io {
	out: (line: string) => void
	err: (line: string) => void
}

type Invocation = { leaf: Leaf; input: unknown; document?: unknown }
type Stdin = () => Promise<string>

const defaultStdin: Stdin = () => Bun.stdin.text()

function builtIn(root: Group, name: string, input: unknown): Invocation | AppError {
	const leaf = findNode(root, [name])
	if (leaf?.kind !== "leaf") return fail("internal")
	return { leaf, input }
}

/** Decides what to run: `--version` and `--help` win, a bare group falls back to its usage. */
async function route(argv: string[], root: Group, stdin: Stdin): Promise<Invocation | AppError> {
	const landed = walk(root, argv)
	if (isAppError(landed)) return landed
	const { node, path, rest } = landed
	const parsed = parseNodeArgs(node.kind === "leaf" ? node.flags : [], rest, path)
	if (isAppError(parsed)) return parsed
	if (parsed.version) return builtIn(root, "version", {})
	if (node.kind === "group") {
		// Only words after a bare `--` can still be left over under a group.
		const stray = parsed.positionals[0]
		return stray === undefined ? builtIn(root, "help", { path }) : unknownCommand(path, stray)
	}
	if (parsed.help) return builtIn(root, "help", { path })
	const input = await parseInput(node, parsed, path, stdin)
	if (isAppError(input)) return input
	const document = input.document === undefined ? {} : { document: input.document }
	return { leaf: node, input: input.input, ...document }
}

type Dispatched = { data: unknown; hint?: RenderHint }

async function dispatch(
	argv: string[],
	env: Env,
	root: Group,
	stdin: Stdin,
): Promise<Dispatched | AppError> {
	const invocation = await route(argv, root, stdin)
	if (isAppError(invocation)) return invocation
	const ctx: Context = { env, root, stdin }
	const result = await invocation.leaf.run(invocation.input, invocation.document, ctx)
	if (isAppError(result)) return result
	// A result that breaks its own output schema is a programming error: it throws, and the
	// top-level catch turns it into the fixed `internal` envelope.
	const data = invocation.leaf.output.parse(result.data)
	return invocation.leaf.render === undefined ? { data } : { data, hint: invocation.leaf.render }
}

function failureOf(error: AppError, format: Format, io: Io): number {
	io.err(renderError(error, format))
	return error.body.exitCode
}

function badFormat(requested: string, io: Io): number {
	const error = fail("unknown_format", {
		message: `Unknown format: ${requested}`,
		hint: "Set TRAJ_FORMAT to human or json, or pass --json.",
	})
	return failureOf(error, "human", io)
}

/** Runs the CLI and returns the exit code. Never calls process.exit, so tests can drive it. */
export async function run(
	argv: string[],
	io: Io,
	env: Env,
	root: Group = defaultRoot,
	stdin: Stdin = defaultStdin,
): Promise<number> {
	// The format is settled first, by a pre-scan that cannot fail, so even a malformed command
	// line is answered in the format the caller asked for.
	const choice = resolveFormat(argv, env)
	try {
		if (choice.invalid !== undefined) return badFormat(choice.invalid, io)
		const outcome = await dispatch(argv, env, root, stdin)
		if (isAppError(outcome)) return failureOf(outcome, choice.format, io)
		io.out(renderResult(outcome.data, choice.format, outcome.hint))
		return 0
	} catch (error) {
		// The message is fixed text; diagnostics go to stderr only when TRAJ_DEBUG asks for them.
		if (env["TRAJ_DEBUG"] === "1") {
			io.err(error instanceof Error ? (error.stack ?? error.message) : String(error))
		}
		return failureOf(fail("internal"), choice.format, io)
	}
}
