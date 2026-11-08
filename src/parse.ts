import { parseArgs } from "node:util"
import { type AppError, fail } from "./errors"
import type { FlagSpec } from "./flags"

export type Parsed = {
	json: boolean
	help: boolean
	version: boolean
	positionals: string[]
	/** Raw values of the leaf's own flags, keyed by input field. */
	fields: Record<string, unknown>
}

function optionsFor(flags: readonly FlagSpec[]) {
	const own = flags.map((spec) => [
		spec.flag,
		{ type: spec.kind === "boolean" ? "boolean" : "string", multiple: spec.multiple },
	])
	return {
		...Object.fromEntries(own),
		json: { type: "boolean" },
		help: { type: "boolean", short: "h" },
		version: { type: "boolean", short: "v" },
	} as const
}

// Plain decimal spellings only: no hex, exponent, Infinity or surrounding spaces.
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

function toFieldValue(spec: FlagSpec, value: unknown): unknown {
	if (spec.kind !== "number") return value
	const asNumber = (text: unknown) =>
		typeof text === "string" && PLAIN_NUMBER.test(text) ? Number(text) : Number.NaN
	return Array.isArray(value) ? value.map(asNumber) : asNumber(value)
}

function failureOf(error: unknown, path: readonly string[]): AppError {
	const message = error instanceof Error ? error.message : ""
	const hint = `Run "traj help${path.map((word) => ` ${word}`).join("")}" to see its flags.`
	const unknown = /^Unknown option '([^']+)'/.exec(message)
	if (unknown) return fail("unknown_flag", { message: `Unknown flag: ${unknown[1]}`, hint })
	// parseArgs words these errors in its own way; we name the flag and say what is wrong.
	const named = /^Option '(-[^' ]+)/.exec(message)
	const flag = named?.[1] ?? "a flag"
	const detail = message.includes("does not take an argument") ? "takes no value" : "needs a value"
	return fail("invalid_input", { message: `Flag ${flag} ${detail}.`, hint })
}

/**
 * `parseArgs` reads a negative number as an option. A flag that takes a value and is followed by
 * a plain negative number gets `--flag=-1.23`, which is the same input spelled unambiguously.
 * Only that one token is joined, and only when it is a plain negative decimal; everything else
 * is left exactly where the caller put it.
 */
function joinNegativeValues(rest: readonly string[], flags: readonly FlagSpec[]): string[] {
	const valued = new Set(flags.filter((spec) => spec.kind !== "boolean").map((spec) => spec.flag))
	const joined: string[] = []
	for (let index = 0; index < rest.length; index += 1) {
		const token = rest[index] ?? ""
		const next = rest[index + 1]
		const name = token.startsWith("--") ? token.slice(2) : ""
		if (valued.has(name) && next?.startsWith("-") && PLAIN_NUMBER.test(next)) {
			joined.push(`${token}=${next}`)
			index += 1
			continue
		}
		joined.push(token)
	}
	return joined
}

/** Strictly parses a node's arguments: the global flags plus the leaf's own flags. */
export function parseNodeArgs(
	flags: readonly FlagSpec[],
	rest: string[],
	path: readonly string[],
): Parsed | AppError {
	try {
		const { values, positionals } = parseArgs({
			args: joinNegativeValues(rest, flags),
			options: optionsFor(flags),
			allowPositionals: true,
			strict: true,
		}) as { values: Record<string, unknown>; positionals: string[] }
		const fields: Record<string, unknown> = {}
		for (const spec of flags) {
			const value = values[spec.flag]
			if (value !== undefined) fields[spec.field] = toFieldValue(spec, value)
		}
		return {
			json: values["json"] === true,
			help: values["help"] === true,
			version: values["version"] === true,
			positionals,
			fields,
		}
	} catch (error) {
		return failureOf(error, path)
	}
}
