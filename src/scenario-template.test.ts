import { describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { run } from "./cli"
import { acceptedScenarioSchemaVersion, scenarioProblems } from "./scenario/document"
import {
	applyScenario,
	documentFile,
	errorOf,
	resultOf,
	scenarioHome,
} from "./scenario-test-support"
import { SCENARIO_DOCUMENT } from "./store/testing"
import { capture } from "./test-support"

const DOC = SCENARIO_DOCUMENT
const SALARY = DOC.flows[0]
const SCHEMA_HINT = 'Run "traj schema scenario apply" to see the document schema.'

describe("scenario apply --template", () => {
	it("prints one byte-identical document for every data directory and format", async () => {
		const first = await capture(["scenario", "apply", "--template"], {
			TRAJ_HOME: scenarioHome(),
		})
		const second = await capture(["scenario", "apply", "--template"], {
			TRAJ_HOME: scenarioHome(),
			TRAJ_FORMAT: "json",
		})
		expect(first.code).toBe(0)
		expect(first.out.endsWith("\n")).toBe(false)
		expect(JSON.parse(second.out)).toBe(first.out)
	})

	it("prints a document the pinned core accepts", async () => {
		const res = await capture(["scenario", "apply", "--template"], { TRAJ_HOME: scenarioHome() })
		expect(scenarioProblems(JSON.parse(res.out))).toEqual([])
		expect(JSON.parse(res.out).schemaVersion).toBe(acceptedScenarioSchemaVersion())
	})

	it("creates no data directory", async () => {
		const absent = join(scenarioHome(), "absent")
		const res = await capture(["scenario", "apply", "--template"], { TRAJ_HOME: absent })
		expect(res.code).toBe(0)
		expect(existsSync(absent)).toBe(false)
	})

	it("never reads stdin", async () => {
		let read = false
		const stdin = async () => {
			read = true
			return JSON.stringify(DOC)
		}
		const out: string[] = []
		const err: string[] = []
		const code = await run(
			["scenario", "apply", "--template", "--json"],
			{ out: (line) => out.push(line), err: (line) => err.push(line) },
			{ TRAJ_HOME: scenarioHome() },
			undefined,
			stdin,
		)
		expect(code).toBe(0)
		expect(read).toBe(false)
		expect(JSON.parse(out.join("\n"))).toBe(await templateText())
	})

	it("applies its own template unchanged, then reports it unchanged", async () => {
		const home = scenarioHome()
		const template = await templateText()
		const created = await applyScenario(home, "base", template)
		expect(created.code).toBe(0)
		expect(resultOf(created).status).toBe("created")
		const again = await applyScenario(home, "base", template)
		expect(again.code).toBe(0)
		expect(resultOf(again).status).toBe("unchanged")
	})

	it("refuses a form that does not take --template, at the field to drop", async () => {
		const home = scenarioHome()
		const cases: [string[], string, string][] = [
			[["--template", "--dry-run"], "dryRun", "dryRun: --template takes no --dry-run"],
			[["base", "--template"], "name", "name: --template takes no name"],
			[["base", "--template", "--dry-run"], "dryRun", "dryRun: --template takes no --dry-run"],
		]
		for (const [argv, path, message] of cases) {
			const res = await capture(["scenario", "apply", ...argv, "--json"], { TRAJ_HOME: home })
			expect(res.code).toBe(2)
			expect(errorOf(res)).toMatchObject({ code: "invalid_input", path, message })
		}
	})

	it("refuses --file beside --template at the document flag", async () => {
		const res = await capture(
			[
				"scenario",
				"apply",
				"base",
				"--file",
				documentFile(DOC),
				"--template",
				"--dry-run",
				"--json",
			],
			{ TRAJ_HOME: scenarioHome() },
		)
		expect(res.code).toBe(2)
		expect(errorOf(res)).toMatchObject({
			code: "invalid_input",
			path: "file",
			message: "--file cannot be combined with --template",
		})
	})

	it("fails a missing name before the document is read from stdin", async () => {
		let read = false
		const stdin = async () => {
			read = true
			return JSON.stringify(DOC)
		}
		const out: string[] = []
		const err: string[] = []
		const code = await run(
			["scenario", "apply", "--file", "-", "--json"],
			{ out: (line) => out.push(line), err: (line) => err.push(line) },
			{ TRAJ_HOME: scenarioHome() },
			undefined,
			stdin,
		)
		expect(code).toBe(2)
		expect(JSON.parse(err.join("\n")).error).toMatchObject({
			code: "invalid_input",
			path: "name",
			message: "name: name the Scenario to apply the document to",
		})
		expect(read).toBe(false)
	})

	it("names the accepted version and the schema on an unsupported one", async () => {
		const accepted = acceptedScenarioSchemaVersion()
		const message = `document.schemaVersion: UNSUPPORTED_SCHEMA_VERSION (the accepted version is ${accepted})`
		const res = await applyScenario(scenarioHome(), "base", { ...DOC, schemaVersion: 1 })
		expect(res.code).toBe(2)
		expect(errorOf(res)).toEqual({
			code: "invalid_input",
			exitCode: 2,
			path: "document.schemaVersion",
			message,
			hint: SCHEMA_HINT,
			details: [{ path: "document.schemaVersion", message, code: "UNSUPPORTED_SCHEMA_VERSION" }],
		})
	})

	it("leaves another refusal's message and gives it no hint", async () => {
		const home = scenarioHome()
		const cases: [unknown, string, string][] = [
			[
				{ ...DOC, flows: [{ ...SALARY, nope: 1 }, ...DOC.flows.slice(1)] },
				"document.flows.0.nope",
				"UNKNOWN_KEY",
			],
			[
				{ ...DOC, flows: [{ ...SALARY, amount: -1 }, ...DOC.flows.slice(1)] },
				"document.flows.0.amount",
				"NEGATIVE_AMOUNT",
			],
		]
		for (const [document, path, code] of cases) {
			const res = await applyScenario(home, "base", document)
			expect(res.code).toBe(2)
			const error = errorOf(res)
			expect(error.message).toBe(`${path}: ${code}`)
			expect(error.hint).toBeUndefined()
		}
	})

	it("shows both usage lines, the flag in Options and the invocation in Examples", async () => {
		const help = await capture(["help", "scenario", "apply"])
		expect(help.code).toBe(0)
		expect(help.out.split("\n").filter((line) => line.startsWith("Usage:"))).toEqual([
			"Usage: traj scenario apply [options] [name]",
			"Usage: traj scenario apply <name> --file <file|-> [--dry-run]",
		])
		expect(help.out).toContain("--template")
		expect(help.out).toContain("traj scenario apply --template")
	})
})

/** The trailing newline belongs to the writer, not to the template string. */
async function templateText(): Promise<string> {
	const res = await capture(["scenario", "apply", "--template"], { TRAJ_HOME: scenarioHome() })
	return res.out
}
