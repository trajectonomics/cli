import { describe, expect, it } from "bun:test"
import { capture } from "./test-support"
import { fixtureRoot } from "./test-tree"

const demo = (argv: string[], env: Record<string, string | undefined> = {}) =>
	capture(argv, env, fixtureRoot)

describe("command tree", () => {
	it("runs a leaf inside a group", async () => {
		const res = await demo(["demo", "echo", "hi", "--json"])
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toEqual({ text: "hi", times: 1, tags: [], from: "none" })
	})

	it("still runs top-level leaves next to groups", async () => {
		expect((await demo(["version"])).code).toBe(0)
	})

	it("prints a group's usage when no subcommand is given", async () => {
		const res = await demo(["demo"])
		expect(res.code).toBe(0)
		expect(res.out).toContain("Usage: traj demo <command>")
		expect(res.out).toContain("echo")
	})

	it("names the whole path when a subcommand is unknown", async () => {
		const res = await demo(["demo", "nope", "--json"])
		expect(res.code).toBe(2)
		const { error } = JSON.parse(res.err)
		expect(error.code).toBe("unknown_command")
		expect(error.message).toContain("demo nope")
	})

	it("does not look for subcommands under a leaf: extra words are input", async () => {
		const res = await demo(["demo", "echo", "hi", "there", "--json"])
		expect(JSON.parse(res.err).error.code).toBe("invalid_input")
	})
})

describe("flags derived from the input schema", () => {
	it("reads booleans, numbers, repeated strings and kebab-cased names", async () => {
		const res = await demo([
			"demo",
			"echo",
			"hi",
			"--upper",
			"--times",
			"3",
			"--tag",
			"a",
			"--tag",
			"b",
			"--from-date",
			"2026-01-01",
			"--json",
		])
		expect(JSON.parse(res.out)).toEqual({
			text: "HI",
			times: 3,
			tags: ["a", "b"],
			from: "2026-01-01",
		})
	})

	it("accepts flags before the subcommand path and between words", async () => {
		const res = await demo(["--json", "demo", "echo", "--upper", "hi"])
		expect(JSON.parse(res.out).text).toBe("HI")
	})

	it("rejects a flag the leaf does not declare", async () => {
		const res = await demo(["demo", "echo", "hi", "--bogus", "--json"])
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error.code).toBe("unknown_flag")
	})

	it("rejects a flag that belongs to another command", async () => {
		const res = await demo(["version", "--upper", "--json"])
		expect(JSON.parse(res.err).error.code).toBe("unknown_flag")
	})

	it("rejects an unknown flag before it finds the leaf", async () => {
		const res = await demo(["--bogus", "demo", "echo", "hi", "--json"])
		expect(JSON.parse(res.err).error.code).toBe("unknown_flag")
	})

	it("reports a value of the wrong type as invalid_input at the field", async () => {
		const res = await demo(["demo", "echo", "hi", "--times", "abc", "--json"])
		expect(res.code).toBe(2)
		const { error } = JSON.parse(res.err)
		expect(error.code).toBe("invalid_input")
		expect(error.path).toBe("times")
	})

	it("reports a flag missing its value as invalid_input", async () => {
		const res = await demo(["demo", "echo", "hi", "--times", "--json"])
		expect(JSON.parse(res.err).error.code).toBe("invalid_input")
	})

	it("reports a missing required positional at its field", async () => {
		const res = await demo(["demo", "echo", "--json"])
		expect(JSON.parse(res.err).error.path).toBe("word")
	})
})

describe("schema addresses commands by path", () => {
	it("lists every leaf by its full path", async () => {
		const data = JSON.parse((await demo(["schema", "--json"])).out)
		const names = data.commands.map((c: { name: string }) => c.name)
		expect(names).toEqual([
			"account add",
			"account close",
			"account list",
			"account show",
			"demo echo",
			"help",
			"init",
			"schema",
			"tx add",
			"version",
		])
		expect(data.errors.length).toBeGreaterThan(0)
	})

	it("lists only the leaves of a group, without the registry", async () => {
		const data = JSON.parse((await demo(["schema", "demo", "--json"])).out)
		expect(data.commands).toEqual([{ name: "demo echo", summary: "Echo a word back" }])
		expect(data.errors).toBeUndefined()
	})

	it("describes a nested leaf, including its positionals and flag fields", async () => {
		const data = JSON.parse((await demo(["schema", "demo", "echo", "--json"])).out)
		expect(data.name).toBe("demo echo")
		expect(data.positionals).toEqual(["word"])
		expect(Object.keys(data.input.properties)).toEqual([
			"word",
			"upper",
			"times",
			"tag",
			"fromDate",
		])
		expect(data.input.required).toEqual(["word"])
	})

	it("rejects a path that does not exist", async () => {
		const res = await demo(["schema", "demo", "nope", "--json"])
		expect(JSON.parse(res.err).error.code).toBe("unknown_command")
	})
})
