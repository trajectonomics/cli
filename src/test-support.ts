import { run } from "./cli"
import type { Group } from "./command"

export type Captured = { code: number; out: string; err: string }

/** The `error` object of a failed run's JSON envelope. */
export type ErrorBody = {
	code: string
	exitCode: number
	message: string
	path?: string
	hint?: string
	details?: unknown
}

export function errorOf(res: Captured): ErrorBody {
	return JSON.parse(res.err).error
}

export async function capture(
	argv: string[],
	env: Record<string, string | undefined> = {},
	root?: Group,
	stdin?: string,
): Promise<Captured> {
	const out: string[] = []
	const err: string[] = []
	const readStdin = stdin === undefined ? undefined : async () => stdin
	const code = await run(
		argv,
		{ out: (l) => out.push(l), err: (l) => err.push(l) },
		env,
		root,
		readStdin,
	)
	return { code, out: out.join("\n"), err: err.join("\n") }
}
