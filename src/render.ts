import type { Env } from "./command"
import type { AppError } from "./errors"
import { type RenderHint, renderTableResult } from "./table"

/** How a command renders its result, chosen explicitly and never inferred from a terminal. */
export type Format = "human" | "json"

export type FormatChoice = {
	format: Format
	/** Set when TRAJ_FORMAT held a value that is neither `human` nor `json`. */
	invalid?: string
}

/**
 * Decides the format before anything that could fail runs. It cannot throw: an unusable
 * TRAJ_FORMAT falls back to human and is reported through `invalid`. `--json` beats the
 * environment, and nothing after a bare `--` counts as a flag.
 */
export function resolveFormat(argv: readonly string[], env: Env): FormatChoice {
	const end = argv.indexOf("--")
	const flags = end === -1 ? argv : argv.slice(0, end)
	if (flags.includes("--json")) return { format: "json" }
	const requested = env["TRAJ_FORMAT"]
	if (requested === undefined || requested === "" || requested === "human") {
		return { format: "human" }
	}
	if (requested === "json") return { format: "json" }
	return { format: "human", invalid: requested }
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isScalar(value: unknown): value is string | number | boolean | null {
	return value === null || ["string", "number", "boolean"].includes(typeof value)
}

function renderHumanLines(value: unknown, indent: string): string[] {
	if (isScalar(value)) return [`${indent}${String(value)}`]
	if (Array.isArray(value)) {
		return value.flatMap((item) => {
			if (isScalar(item)) return [`${indent}- ${String(item)}`]
			const [first = "", ...rest] = renderHumanLines(item, `${indent}  `)
			return [`${indent}- ${first.trimStart()}`, ...rest]
		})
	}
	if (isRecord(value)) {
		return Object.entries(value).flatMap(([key, child]) =>
			isScalar(child)
				? [`${indent}${key}: ${String(child)}`]
				: [`${indent}${key}:`, ...renderHumanLines(child, `${indent}  `)],
		)
	}
	return [`${indent}${JSON.stringify(value)}`]
}

/** Renders a validated result. A string is printed as is, so `--version` stays bare. */
export function renderResult(data: unknown, format: Format, hint?: RenderHint): string {
	if (format === "json") return JSON.stringify(data)
	if (typeof data === "string") return data
	const tables = hint === undefined ? null : renderTableResult(data, hint)
	return tables ?? renderHumanLines(data, "").join("\n")
}

/** Renders a failure: the JSON envelope when the Format is json, otherwise text. */
export function renderError(error: AppError, format: Format): string {
	const { body } = error
	if (format === "json") return JSON.stringify({ error: body })
	const where = body.path === undefined ? "" : ` (${body.path})`
	const lines = [`error: ${body.code}${where}: ${body.message}`]
	if (body.hint !== undefined) lines.push(`hint: ${body.hint}`)
	return lines.join("\n")
}
