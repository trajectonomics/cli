import { z } from "zod"

/*
 * The two result shapes `traj schema` prints: the root listing and one command's detail. They are
 * the output schema the command publishes and the shape its own result is validated against, which
 * is why `document` and `flagDocuments` are JSON Schema records rather than command types
 * (ADR-0010, ADR-0020).
 */

const jsonSchema = z.record(z.string(), z.unknown())

export function listingSchema(): z.ZodType {
	return z.strictObject({
		commands: z.array(z.strictObject({ name: z.string(), summary: z.string() })),
		errors: z
			.array(
				z.strictObject({
					code: z.string(),
					exitCode: z.number().int().min(0).max(5),
					message: z.string(),
					retryable: z.boolean().describe("True when retrying the same command can succeed."),
				}),
			)
			.optional()
			.describe("The whole error registry, sorted by code. Only listed for the root."),
		notSupported: z
			.array(z.strictObject({ feature: z.string(), detail: z.string() }))
			.optional()
			.describe(
				"What this version cannot do, so a plan does not assume it. Only listed for the root.",
			),
	})
}

const document = z
	.strictObject({
		flag: z.string().describe("The input field that names the document; `-` reads stdin."),
		schema: jsonSchema.describe("JSON Schema of the document form's input."),
		required: z
			.array(z.string())
			.optional()
			.describe("The input fields the document form requires, checked before it is read."),
	})
	.describe("The alternate document form, beside the flag form.")

const flagDocument = z
	.strictObject({
		flag: z
			.string()
			.describe("The input field that names the document; its flag takes a path, or - for stdin."),
		schema: jsonSchema.describe("JSON Schema of the document that field names."),
	})
	.describe("A document a flag names beside the other flags, not the document form.")

export function detailSchema(): z.ZodType {
	return z.strictObject({
		name: z.string().describe("The full command path."),
		summary: z.string(),
		positionals: z.array(z.string()).describe("Input fields filled from words, in order."),
		input: jsonSchema.describe("JSON Schema of the command's input. Non-positionals are flags."),
		document: document.optional(),
		flagDocuments: z
			.array(flagDocument)
			.optional()
			.describe("Documents a flag names, beside the document form and the input schema."),
		output: jsonSchema.describe("JSON Schema of the command's result."),
		examples: z.array(z.strictObject({ command: z.string(), description: z.string() })),
		errorCodes: z.array(z.string()).describe("Registry codes this command raises."),
	})
}
