import { describe, expect, it } from "bun:test"
import type { Leaf } from "./command"
import { root } from "./commands"
import type { RegistryEntry } from "./error-listing"
import { SENTENCES } from "./sentences"
import { capture, type ErrorBody, errorOf } from "./test-support"
import { leavesOf } from "./tree"
import { tempHome } from "./tx-test-support"

/** The validation library's vocabulary, which never reaches the envelope (ADR-0013). */
const PROSE = /Invalid input|Too small|Too big|Invalid option|Unrecognized key|expected .+ received/

const SENTENCE_TEXT: readonly string[] = Object.values(SENTENCES)

function rowsOf(details: unknown): { path?: string; message?: string }[] {
	if (!Array.isArray(details)) return []
	return details.filter(
		(row): row is { path?: string; message?: string } => typeof row === "object" && row !== null,
	)
}

/** The 8 leaves that succeed with no arguments; a new failing leaf has to be added to the test. */
const SUCCEEDING = new Set([
	"account list",
	"help",
	"init",
	"inspect",
	"scenario list",
	"schema",
	"tx list",
	"version",
])

/** A command may raise its own CLI sentence for a missing input, outside the table. */
const OWN_SENTENCES: Record<string, string> = {
	"scenario apply": "Name a JSON document, - for stdin, or --template",
	"tx import": "Name a CSV file, - for stdin, or --template",
}

/** True when a path is the caller's input: a flag, a declared positional or a document path. */
function isKnownPath(leaf: Leaf, input: string): boolean {
	return input.startsWith("--") || input.startsWith("document") || leaf.positionals.includes(input)
}

function checkPath(name: string, error: ErrorBody, leaf: Leaf): void {
	const input = error.path ?? ""
	const named = input.startsWith("--") || leaf.positionals.includes(input)
	expect({ name, known: isKnownPath(leaf, input) }).toEqual({ name, known: true })
	const present = error.hint !== undefined
	expect({ name, hint: named ? present : !present }).toEqual({ name, hint: true })
}

function checkSentence(name: string, message: string): void {
	expect(message).not.toMatch(PROSE)
	const own = OWN_SENTENCES[name]
	if (own !== undefined) expect(message).toBe(own)
	else expect({ name, table: SENTENCE_TEXT.includes(message) }).toEqual({ name, table: true })
}

function checkRows(name: string, leaf: Leaf, details: unknown): void {
	for (const row of rowsOf(details)) {
		expect(row.message ?? "").not.toMatch(PROSE)
		const input = row.path ?? ""
		expect({ name, row: isKnownPath(leaf, input) }).toEqual({ name, row: true })
	}
}

describe("every leaf with no arguments", () => {
	it("names the caller's input in a CLI sentence, or succeeds", async () => {
		for (const { path, leaf } of leavesOf(root)) {
			const name = path.join(" ")
			const res = await capture([...path, "--json"], { TRAJ_HOME: tempHome() })
			if (SUCCEEDING.has(name)) {
				expect({ name, code: res.code }).toEqual({ name, code: 0 })
				continue
			}
			const error = errorOf(res)
			expect({ name, code: error.code, exit: error.exitCode }).toEqual({
				name,
				code: "invalid_input",
				exit: 2,
			})
			checkPath(name, error, leaf)
			checkSentence(name, error.message)
			checkRows(name, leaf, error.details)
		}
	})

	it("keeps one invalid_input row in the registry listing", async () => {
		const res = await capture(["schema", "--json"], { TRAJ_HOME: tempHome() })
		const errors = JSON.parse(res.out).errors as RegistryEntry[]
		expect(errors.find((entry) => entry.code === "invalid_input")).toEqual({
			code: "invalid_input",
			exitCode: 2,
			message: "The input is invalid.",
			retryable: false,
		})
	})
})
