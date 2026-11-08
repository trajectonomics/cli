import { describe, expect, it } from "bun:test"
import { readdirSync } from "node:fs"
import { join } from "node:path"
import { z } from "zod"
import type { Node } from "./command"
import { defineCommand, defineGroup, ok } from "./command"
import { root } from "./commands"
import { leavesOf } from "./tree"

const base = {
	name: "x",
	summary: "x",
	positionals: [] as string[],
	output: z.string(),
	examples: [],
	errorCodes: [],
	run: () => ok("x"),
}

describe("registration is checked when a command is defined", () => {
	it("rejects an input field that cannot be a flag", () => {
		expect(() => defineCommand({ ...base, input: z.strictObject({ when: z.date() }) })).toThrow(
			'"when"',
		)
	})

	it("rejects a field that collides with a global flag", () => {
		expect(() =>
			defineCommand({ ...base, input: z.strictObject({ json: z.boolean().optional() }) }),
		).toThrow("--json")
	})

	it("rejects a positional that is not an input field", () => {
		expect(() =>
			defineCommand({ ...base, positionals: ["ghost"], input: z.strictObject({}) }),
		).toThrow('"ghost"')
	})

	it("rejects a variadic positional that is not last", () => {
		expect(() =>
			defineCommand({
				...base,
				positionals: ["rest", "after"],
				input: z.strictObject({ rest: z.array(z.string()), after: z.string() }),
			}),
		).toThrow("last")
	})

	it("rejects a positional that is not a string, since only flags are coerced", () => {
		expect(() =>
			defineCommand({
				...base,
				positionals: ["count"],
				input: z.strictObject({ count: z.number() }),
			}),
		).toThrow('"count"')
	})

	it("rejects two fields that map to the same flag", () => {
		expect(() =>
			defineCommand({
				...base,
				input: z.strictObject({
					fromDate: z.string().optional(),
					"from-date": z.string().optional(),
				}),
			}),
		).toThrow("--from-date")
	})

	it("rejects a repeated positional", () => {
		expect(() =>
			defineCommand({
				...base,
				positionals: ["a", "a"],
				input: z.strictObject({ a: z.string() }),
			}),
		).toThrow('"a"')
	})

	it("rejects an input schema that is not strict", () => {
		expect(() => defineCommand({ ...base, input: z.object({}) })).toThrow("strict")
	})

	it("rejects a child name that could never be reached", () => {
		const leaf = defineCommand({ ...base, name: "-x", input: z.strictObject({}) })
		expect(() => defineGroup({ name: "g", summary: "g", children: [leaf] })).toThrow('"-x"')
	})

	it("rejects two children with the same name in a group", () => {
		const leaf = defineCommand({ ...base, input: z.strictObject({}) })
		expect(() => defineGroup({ name: "g", summary: "g", children: [leaf, leaf] })).toThrow('"x"')
	})
})

describe("the command tree", () => {
	it("registers every leaf exported from a file under src/commands", async () => {
		const files = readdirSync(join(import.meta.dir, "commands"), { recursive: true })
			.map(String)
			.filter((file) => file.endsWith(".ts") && !file.endsWith("index.ts"))
		const registered = new Set<Node>(leavesOf(root).map(({ leaf }) => leaf))
		expect(files.length).toBeGreaterThan(0)
		for (const file of files) {
			const exported = Object.values(await import(`./commands/${file}`)) as Node[]
			for (const node of exported) expect(registered.has(node)).toBe(true)
		}
	})
})
