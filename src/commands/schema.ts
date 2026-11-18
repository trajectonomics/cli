import { z } from "zod"
import type { Leaf } from "../command"
import { defineCommand, ok } from "../command"
import { registryListing } from "../error-listing"
import { fail } from "../errors"
import { NOT_SUPPORTED } from "../schema/limits"
import { detailSchema, listingSchema } from "../schema/output"
import { findNode, leavesOf } from "../tree"

export const schema: Leaf = defineCommand({
	name: "schema",
	summary: "Describe the commands and the error registry",
	positionals: ["path"],
	input: z.strictObject({
		path: z.array(z.string()).default([]).describe("A command or group path; omit to list all."),
	}),
	output: z.union([listingSchema(), detailSchema()]),
	examples: [
		{
			command: "traj schema",
			description: "List commands, every error code and what this version does not support.",
		},
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
			return ok(
				input.path.length === 0
					? { commands, errors: registryListing(), notSupported: [...NOT_SUPPORTED] }
					: { commands },
			)
		}
		const document =
			node.document === undefined
				? {}
				: {
						document: {
							flag: node.document.flag,
							schema: z.toJSONSchema(node.document.schema, { io: "input" }),
							...(node.document.required === undefined
								? {}
								: { required: node.document.required.map((entry) => entry.field) }),
						},
					}
		const documents =
			node.flagDocuments === undefined
				? {}
				: {
						flagDocuments: node.flagDocuments.map((entry) => ({
							flag: entry.flag,
							schema: z.toJSONSchema(entry.schema, { io: "input" }),
						})),
					}
		return ok({
			name: input.path.join(" "),
			summary: node.summary,
			positionals: [...node.positionals],
			input: z.toJSONSchema(node.input, { io: "input" }),
			...document,
			...documents,
			output: z.toJSONSchema(node.output, { io: "output" }),
			examples: node.examples.map((example) => ({ ...example })),
			errorCodes: [...node.errorCodes].sort(),
		})
	},
})
