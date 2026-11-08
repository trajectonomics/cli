import { z } from "zod"
import type { Leaf } from "../command"
import { defineCommand, ok } from "../command"
import { type ErrorCode, fail, registry } from "../errors"
import { findNode, leavesOf } from "../tree"

const jsonSchema = z.record(z.string(), z.unknown())

const listing = z.strictObject({
	commands: z.array(z.strictObject({ name: z.string(), summary: z.string() })),
	errors: z
		.array(
			z.strictObject({
				code: z.string(),
				exitCode: z.number().int().min(0).max(5),
				message: z.string(),
			}),
		)
		.optional()
		.describe("The whole error registry, sorted by code. Only listed for the root."),
})

const document = z
	.strictObject({
		flag: z.string().describe("The input field that names the document; `-` reads stdin."),
		schema: jsonSchema.describe("JSON Schema of the document form's input."),
	})
	.describe("The alternate document form, beside the flag form.")

const detail = z.strictObject({
	name: z.string().describe("The full command path."),
	summary: z.string(),
	positionals: z.array(z.string()).describe("Input fields filled from words, in order."),
	input: jsonSchema.describe("JSON Schema of the command's input. Non-positionals are flags."),
	document: document.optional(),
	output: jsonSchema.describe("JSON Schema of the command's result."),
	examples: z.array(z.strictObject({ command: z.string(), description: z.string() })),
	errorCodes: z.array(z.string()).describe("Registry codes this command raises."),
})

function registryListing() {
	const codes = (Object.keys(registry) as ErrorCode[]).sort()
	return codes.map((code) => ({
		code,
		exitCode: registry[code].exit,
		message: registry[code].message,
	}))
}

export const schema: Leaf = defineCommand({
	name: "schema",
	summary: "Describe the commands and the error registry",
	positionals: ["path"],
	input: z.strictObject({
		path: z.array(z.string()).default([]).describe("A command or group path; omit to list all."),
	}),
	output: z.union([listing, detail]),
	examples: [
		{ command: "traj schema", description: "List commands and every error code." },
		{ command: "traj schema init --json", description: "Show the input and output of init." },
	],
	errorCodes: ["unknown_command"],
	run: (input, ctx) => {
		const node = findNode(ctx.root, input.path)
		if (!node) {
			return fail("unknown_command", {
				message: `Unknown command: ${input.path.join(" ")}`,
				hint: 'Run "traj schema" to list commands.',
			})
		}
		const placed = leavesOf(node, [...input.path])
		if (node.kind === "group") {
			const commands = placed.map(({ path, leaf }) => ({
				name: path.join(" "),
				summary: leaf.summary,
			}))
			return ok(input.path.length === 0 ? { commands, errors: registryListing() } : { commands })
		}
		const document =
			node.document === undefined
				? {}
				: {
						document: {
							flag: node.document.flag,
							schema: z.toJSONSchema(node.document.schema, { io: "input" }),
						},
					}
		return ok({
			name: input.path.join(" "),
			summary: node.summary,
			positionals: [...node.positionals],
			input: z.toJSONSchema(node.input, { io: "input" }),
			...document,
			output: z.toJSONSchema(node.output, { io: "output" }),
			examples: node.examples.map((example) => ({ ...example })),
			errorCodes: [...node.errorCodes].sort(),
		})
	},
})
