import { describe, expect, it } from "bun:test"
import { root } from "./commands"
import { capture } from "./test-support"
import { fixtureRoot } from "./test-tree"
import { leavesOf } from "./tree"

const demo = (argv: string[]) => capture(argv, {}, fixtureRoot)

describe("usage", () => {
	it("lists groups next to commands at the root", async () => {
		const res = await demo([])
		expect(res.out).toContain("demo")
		expect(res.out).toContain("A fixture group")
	})

	it("explains a leaf from its schema for --help and for `help <path>`", async () => {
		for (const argv of [
			["demo", "echo", "--help"],
			["help", "demo", "echo"],
		]) {
			const res = await demo(argv)
			expect(res.code).toBe(0)
			expect(res.out).toContain("Usage: traj demo echo [options] <word>")
			expect(res.out).toContain("--times <number>")
			expect(res.out).toContain("How many times")
			expect(res.out).toContain("--tag <string>")
			expect(res.out).toContain("repeatable")
			expect(res.out).toContain("--from-date <string>")
			expect(res.out).toContain("--upper")
			expect(res.out).toContain("traj demo echo hi --upper")
		}
	})

	it("prints a group's usage for `help <group>` and `<group> --help`", async () => {
		for (const argv of [
			["help", "demo"],
			["demo", "--help"],
		]) {
			const res = await demo(argv)
			expect(res.out).toContain("Usage: traj demo <command>")
		}
	})

	it("rejects `help` for a path that does not exist", async () => {
		const res = await demo(["help", "demo", "nope", "--json"])
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error.code).toBe("unknown_command")
	})

	it("answers --help in JSON when asked", async () => {
		const res = await demo(["demo", "echo", "--help", "--json"])
		expect(JSON.parse(res.out)).toContain("Usage: traj demo echo")
	})
})

describe("the root usage", () => {
	it("states every exit class and exactly which codes are retryable", async () => {
		for (const argv of [["help"], ["--help"]]) {
			const res = await capture(argv)
			expect(res.code).toBe(0)
			expect(res.out).toContain("Exit codes:")
			expect(res.out).toContain("2  invalid input")
			expect(res.out).toContain("5  conflict")
			expect(res.out).toContain("Retryable codes: database_busy, disk_full")
			expect(res.out).toContain("Every other failure is permanent.")
		}
	})
})

describe("a release note on a definition", () => {
	it("prints the note under the summary on the group and its leaf, in human and JSON", async () => {
		for (const argv of [
			["help", "baseline"],
			["baseline", "--help"],
			["help", "baseline", "show"],
			["baseline", "show", "--help"],
		]) {
			const res = await capture(argv)
			expect(res.code).toBe(0)
			expect(res.out).toContain("Projection ships in 0.2.0.")
		}

		const group = (await capture(["help", "baseline"])).out
		expect(group).toContain(
			"Show the Baseline a Projection starts from\n\nProjection ships in 0.2.0.\n\nCommands:",
		)
		const leaf = (await capture(["help", "baseline", "show"])).out
		expect(leaf).toContain(
			"Show the Baseline a Projection starts from at a date\n\nProjection ships in 0.2.0.\n\nOptions:",
		)
		const json = JSON.parse((await capture(["help", "baseline", "show", "--json"])).out)
		expect(json).toContain("Projection ships in 0.2.0.")
	})

	it("states the release in the form ships in X.Y.Z", async () => {
		for (const argv of [
			["help", "baseline"],
			["help", "baseline", "show"],
		]) {
			expect((await capture(argv)).out).toMatch(/\bships in \d+\.\d+\.\d+\b/)
		}
	})

	it("leaves a page without a note exactly as it was", async () => {
		// The fixture tree carries no notes: its summary is still followed by a blank line and
		// the next section, with nothing inserted between them.
		expect((await demo(["help", "demo"])).out).toContain("A fixture group\n\nCommands:")
		expect((await demo(["help", "demo", "echo"])).out).toContain("Echo a word back\n\nOptions:")
		// Only the two baseline pages carry a note; every other page is unchanged.
		for (const argv of [["help"], ["help", "tx"], ["help", "help"]]) {
			expect((await capture(argv)).out).not.toMatch(/\bships in \d/)
		}
		for (const { path } of leavesOf(root)) {
			if (path.join(" ") === "baseline show") continue
			expect((await capture(["help", ...path])).out).not.toMatch(/\bships in \d/)
		}
	})

	it("does not expose the note in the machine contract", async () => {
		const detail = JSON.parse((await capture(["schema", "baseline", "show", "--json"])).out)
		expect(detail).not.toHaveProperty("note")
		const listing = JSON.parse((await capture(["schema", "baseline", "--json"])).out)
		for (const row of listing.commands) {
			expect(Object.keys(row)).toEqual(["name", "summary"])
		}
	})
})

describe("document-form usage", () => {
	it("shows a document-form leaf's positionals in the alternate line", async () => {
		const usages = (await capture(["help", "tx", "amend"])).out
			.split("\n")
			.filter((line) => line.startsWith("Usage:"))
		expect(usages).toHaveLength(2)
		expect(usages[1]).toBe(
			"Usage: traj tx amend <id> --postings <file|-> [--void-date <string>] [--dry-run]",
		)
	})

	it("prints one usage line for a document-only leaf", async () => {
		const res = await demo(["help", "demo", "doc"])
		expect(res.code).toBe(0)
		const usages = res.out.split("\n").filter((line) => line.startsWith("Usage:"))
		expect(usages).toEqual(["Usage: traj demo doc <name> --file <file|-> [--dry-run]"])
		expect(res.out).toContain("--file <string>")
	})

	it("keeps both usage lines for a leaf with a flag form and a document form", async () => {
		const usages = (await capture(["help", "tx", "add"])).out
			.split("\n")
			.filter((line) => line.startsWith("Usage:"))
		expect(usages).toHaveLength(2)
	})
})
