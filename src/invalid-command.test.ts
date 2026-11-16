import { describe, expect, it } from "bun:test"
import { z } from "zod"
import { defineCommand, defineGroup } from "./command"
import { fail } from "./errors"
import { applyScenario, scenarioHome } from "./scenario-test-support"
import { SCENARIO_DOCUMENT } from "./store/testing"
import { capture, errorOf } from "./test-support"
import { cli, tempHome } from "./tx-test-support"

const hint = (path: string) => `Run "traj help ${path}" to see its flags.`

const projectionFlags = ["--as-of", "2026-03-31", "--horizon", "2027-03-30"]

describe("a command-raised failure names the input the caller typed", () => {
	it("drops tx import's file: prefix and carries the help hint", async () => {
		const error = errorOf(await cli(tempHome())(["tx", "import", "/nope.csv", "--json"]))
		expect(error).toEqual({
			code: "invalid_input",
			exitCode: 2,
			message: 'Cannot read "/nope.csv"',
			path: "file",
			hint: hint("tx import"),
		})
	})

	it("drops a file: prefix from an exclusive form and keeps the positional", async () => {
		const error = errorOf(
			await cli(tempHome())(["tx", "import", "rows.csv", "--template", "--json"]),
		)
		expect(error).toMatchObject({
			path: "file",
			message: "--template takes no file",
			hint: hint("tx import"),
		})
	})

	it("names --dry-run when --template refuses a dry run", async () => {
		const error = errorOf(
			await cli(tempHome())(["tx", "import", "--template", "--dry-run", "--json"]),
		)
		expect(error).toMatchObject({
			path: "--dry-run",
			message: "--template takes no --dry-run",
			hint: hint("tx import"),
		})
	})

	it("names --all and keeps its own hint", async () => {
		const error = errorOf(
			await capture(["inspect", "tx", "--all", "--json"], { TRAJ_HOME: tempHome() }),
		)
		expect(error).toMatchObject({
			path: "--all",
			message: "--all takes no table name.",
			hint: "Name one table to show that table, or pass --all alone to show every table.",
		})
	})

	it("names --none beside the flags that write a Levy, keeping its words", async () => {
		const error = errorOf(
			await capture(["scenario", "tax", "base", "--none", "--tax", "th-2026", "--json"], {
				TRAJ_HOME: tempHome(),
			}),
		)
		expect(error).toMatchObject({
			path: "--none",
			message: "--none removes the tax, so it cannot be combined with the flags that write one.",
			hint: hint("scenario tax"),
		})
	})

	it("names the positional b when compare has neither a second Scenario nor --set", async () => {
		const error = errorOf(
			await capture(["projection", "compare", "base", ...projectionFlags, "--json"], {
				TRAJ_HOME: tempHome(),
			}),
		)
		expect(error).toMatchObject({
			path: "b",
			message: "compare needs exactly one of a second Scenario or --set.",
			hint: "Pass a second Scenario name, or --set to compare the first one with a what-if.",
		})
	})

	it("names --age when it has no --birth-date", async () => {
		const error = errorOf(
			await capture(
				[
					"projection",
					"compare",
					"base",
					...projectionFlags,
					"--set",
					"x=1",
					"--age",
					"45",
					"--json",
				],
				{ TRAJ_HOME: tempHome() },
			),
		)
		expect(error).toMatchObject({
			path: "--age",
			message: "--age needs --birth-date to know which birthday to read.",
			hint: "Pass --birth-date YYYY-MM-DD beside --age.",
		})
	})

	it("names --set and keeps the set's own hint", async () => {
		const home = scenarioHome()
		await applyScenario(home, "base", SCENARIO_DOCUMENT)
		const error = errorOf(
			await capture(
				["projection", "run", "--scenario", "base", ...projectionFlags, "--set", "nope", "--json"],
				{ TRAJ_HOME: home },
			),
		)
		expect(error).toMatchObject({
			path: "--set",
			message: '"nope" has no unescaped = between the path and the value',
			hint: "A --set is path=json, such as --set flows.salary.amount=50000.",
			details: { index: 0, path: "nope" },
		})
	})

	it("leaves a dotted document path alone and gives it no hint", async () => {
		const csv = 'date,from,to,amount,memo,external_ref,project\n2026-03-01,a"b,Cash,1.00,,,\n'
		const error = errorOf(
			await capture(["tx", "import", "-", "--json"], { TRAJ_HOME: tempHome() }, undefined, csv),
		)
		expect(error).toMatchObject({
			path: "line.2",
			message: "line.2: a quote inside an unquoted field must be doubled or the field quoted",
		})
		expect(error.hint).toBeUndefined()
	})
})

describe("a path that is not this leaf's input stays as the store wrote it", () => {
	it("keeps linkedTo and its authored message, adding no hint", async () => {
		const probe = defineCommand({
			name: "probe",
			summary: "Return a store failure",
			positionals: [],
			input: z.strictObject({ word: z.string().optional() }),
			output: z.null(),
			examples: [],
			errorCodes: [],
			run: () =>
				fail("invalid_input", {
					path: "linkedTo",
					message: "linkedTo: no transaction here",
				}),
		})
		const root = defineGroup({ name: "traj", summary: "probe tree", children: [probe] })
		const error = errorOf(await capture(["probe", "--json"], {}, root))
		expect(error).toMatchObject({
			path: "linkedTo",
			message: "linkedTo: no transaction here",
		})
		expect(error.hint).toBeUndefined()
	})
})

describe("array details follow the envelope, object details do not", () => {
	it("rewrites a row that names an input and keeps a core row's code", async () => {
		const probe = defineCommand({
			name: "rows",
			summary: "Return issue-shaped details",
			positionals: [],
			input: z.strictObject({ word: z.string().optional() }),
			output: z.null(),
			examples: [],
			errorCodes: [],
			run: () =>
				fail("invalid_input", {
					path: "word",
					message: "word: bad value",
					details: [
						{ path: "word", message: "word: bad value" },
						{
							path: "document.flows.0.nope",
							message: "document.flows.0.nope: UNKNOWN_KEY",
							code: "UNKNOWN_KEY",
						},
					],
				}),
		})
		const root = defineGroup({ name: "traj", summary: "probe tree", children: [probe] })
		const error = errorOf(await capture(["rows", "--json"], {}, root))
		expect(error).toMatchObject({
			path: "--word",
			message: "Bad value",
			hint: hint("rows"),
			details: [
				{ path: "--word", message: "Bad value" },
				{
					path: "document.flows.0.nope",
					message: "document.flows.0.nope: UNKNOWN_KEY",
					code: "UNKNOWN_KEY",
				},
			],
		})
	})
})
