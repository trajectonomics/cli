import { describe, expect, it } from "bun:test"
import { z } from "zod"
import { defineCommand, defineGroup, ok } from "./command"
import { root } from "./commands"
import { checkReleaseDocs, type HelpNote, helpNotes, type ReleaseFacts } from "./release-docs"

const LATEST = "0.1.0"
const RELEASED = ["help", "init", "scenario show", "schema", "tx add"]

/** A README around one section body, so a fixture's line numbers stay predictable. */
const readmeWith = (body: string) => `# traj\n\n## Reading the future\n\n${body}\n`

const facts = (readme: string, overrides: Partial<ReleaseFacts> = {}): ReleaseFacts => ({
	readme,
	known: RELEASED,
	latestVersion: LATEST,
	notes: [],
	...overrides,
})

const pullRequest = (readme: string, overrides: Partial<ReleaseFacts> = {}) =>
	checkReleaseDocs(facts(readme, overrides), "pull-request")

const freshness = (readme: string, overrides: Partial<ReleaseFacts> = {}) =>
	checkReleaseDocs(facts(readme, overrides), "freshness")

describe("the README's commands against the latest release", () => {
	it("reports an unreleased command outside a marked section, with its line and the fix", () => {
		const problems = pullRequest(readmeWith("`traj projection run` rolls up net worth."))
		expect(problems).toHaveLength(1)
		const [problem] = problems
		expect(problem?.code).toBe("unreleased_command")
		expect(problem?.line).toBe(5)
		expect(problem?.message).toContain("projection run")
		expect(problem?.message).toContain("Ships in X.Y.Z")
		expect(problem?.message).toContain("take the command out")
	})

	it("passes the same command inside a section marked for a newer release", () => {
		const body = [
			"> **Ships in 0.2.0.**",
			"> The release you installed does not have them yet.",
			"",
			"`traj projection run` rolls up net worth.",
		].join("\n")
		expect(pullRequest(readmeWith(body))).toEqual([])
	})

	it("does not pass a command under a marker naming the latest release", () => {
		const body = ["> **Ships in 0.1.0.**", "", "`traj projection run` rolls up net worth."].join(
			"\n",
		)
		const problems = pullRequest(readmeWith(body))
		expect(problems.map((problem) => problem.code)).toEqual(["unreleased_command"])
	})

	it("passes a README that names only released commands, with no marker at all", () => {
		expect(
			pullRequest(
				readmeWith(
					"`traj help schema` lists them, and `traj tx add` writes one.\n\n```\n$ traj scenario show my-plan\n```",
				),
			),
		).toEqual([])
	})

	it("checks fenced blocks as well as inline code spans", () => {
		const problems = pullRequest(readmeWith("```bash\ntraj scenario tax 2026 --tax th-2026\n```"))
		expect(problems).toHaveLength(1)
		expect(problems[0]?.message).toContain("scenario tax")
	})

	it("takes the longest command path and ignores the placeholders and flags after it", () => {
		const problems = pullRequest(readmeWith("`traj scenario tax <name> --tax th-2026` writes tax."))
		expect(problems).toHaveLength(1)
		expect(problems[0]?.message).toContain("scenario tax")
		expect(problems[0]?.message).not.toContain("<name>")
	})

	it("reads no command out of prose, a file path or a bare `traj`", () => {
		const body = [
			"Run `traj` and read `dist/traj` or `~/.traj/bin`.",
			"The word traj projection run in plain prose is not a command.",
		].join("\n")
		expect(pullRequest(readmeWith(body))).toEqual([])
	})
})

describe("the freshness rule", () => {
	it("reports a marker that names the latest release, and no pull request fails on it", () => {
		const body = ["> **Ships in 0.1.0.**", "", "`traj scenario show` prints it."].join("\n")
		const readme = readmeWith(body)
		expect(pullRequest(readme)).toEqual([])
		const problems = freshness(readme)
		expect(problems).toHaveLength(1)
		expect(problems[0]?.code).toBe("stale_marker")
		expect(problems[0]?.line).toBe(5)
		expect(problems[0]?.message).toContain("0.1.0")
	})

	it("passes a marker that names a release newer than the latest", () => {
		const body = ["> **Ships in 0.2.0.**", "", "`traj projection run` rolls up."].join("\n")
		expect(freshness(readmeWith(body))).toEqual([])
	})

	it("reports a help note that names the latest release, and ignores notes on a pull request", () => {
		const notes: HelpNote[] = [{ command: "baseline show", note: "Projection ships in 0.1.0." }]
		const readme = readmeWith("`traj scenario show` prints it.")
		expect(pullRequest(readme, { notes })).toEqual([])
		const problems = freshness(readme, { notes })
		expect(problems).toHaveLength(1)
		expect(problems[0]?.code).toBe("stale_marker")
		expect(problems[0]?.line).toBeUndefined()
		expect(problems[0]?.message).toContain("baseline show")
		expect(problems[0]?.message).toContain("0.1.0")
	})

	it("reports a help note that names no release at all", () => {
		const notes: HelpNote[] = [{ command: "baseline show", note: "Projection is new." }]
		const problems = freshness(readmeWith("`traj scenario show` prints it."), { notes })
		expect(problems).toHaveLength(1)
		expect(problems[0]?.message).toContain("ships in X.Y.Z")
	})
})

describe("help notes in a command tree", () => {
	it("collects the note on a group and on its leaf, in path order", () => {
		const leaf = defineCommand({
			name: "show",
			summary: "Show it",
			note: "Projection ships in 0.2.0.",
			positionals: [],
			input: z.strictObject({}),
			output: z.null(),
			examples: [],
			errorCodes: [],
			run: () => ok(null),
		})
		const group = defineGroup({
			name: "baseline",
			summary: "Show it",
			note: "Projection ships in 0.2.0.",
			children: [leaf],
		})
		const root = defineGroup({ name: "traj", summary: "traj", children: [group] })
		expect(helpNotes(root)).toEqual([
			{ command: "baseline", note: "Projection ships in 0.2.0." },
			{ command: "baseline show", note: "Projection ships in 0.2.0." },
		])
	})

	it("returns nothing for a tree without notes", () => {
		const empty = defineGroup({ name: "traj", summary: "traj", children: [] })
		expect(helpNotes(empty)).toEqual([])
	})

	it("keeps every note on this tree in the release-marker form the freshness run reads", () => {
		// `note` is the release annotation only (ADR-0034): the freshness run flags any other text.
		for (const { command, note } of helpNotes(root)) {
			expect({ command, note }).toEqual({
				command,
				note: expect.stringMatching(/\bships in \d+\.\d+\.\d+\b/i),
			})
		}
	})
})
