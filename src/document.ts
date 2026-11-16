import { readFileSync } from "node:fs"
import { z } from "zod"
import type { DocumentSpec, RequiredDocumentField } from "./command"
import { documentFailure } from "./document-issues"
import { type AppError, fail } from "./errors"

/** Fields that only the flag form uses: everything not the document flag or an allowed field. */
export function exclusiveFields(input: z.ZodObject, spec: DocumentSpec): string[] {
	const keep = new Set([spec.flag, ...(spec.allowed ?? [])])
	return Object.keys(input.shape).filter((field) => !keep.has(field))
}

/** The flags the document form accepts, validated as their own strict object. */
export function selectionSchema(input: z.ZodObject, spec: DocumentSpec): z.ZodObject {
	const keep = new Set([spec.flag, ...(spec.allowed ?? [])])
	const shape = Object.fromEntries(
		Object.entries(input.shape).filter(([field]) => keep.has(field)),
	) as Record<string, z.ZodType>
	return z.strictObject(shape)
}

/**
 * The failure for a field the document form cannot work without, raised before the document is
 * read. The field is a positional's declared name today, so the path is the field itself.
 */
export function missingFieldError(required: RequiredDocumentField): AppError {
	return fail("invalid_input", {
		path: required.field,
		message: `${required.field}: ${required.sentence}`,
	})
}

/** Fails at definition time if the document form names a field that is not an input field. */
export function checkDocument(input: z.ZodObject, document: DocumentSpec | undefined): void {
	if (document === undefined) return
	if (!(document.flag in input.shape)) {
		throw new Error(`Document flag "${document.flag}" is not a field of the input schema.`)
	}
	for (const field of document.allowed ?? []) {
		if (!(field in input.shape)) {
			throw new Error(`Document field "${field}" is not a field of the input schema.`)
		}
	}
	for (const { field } of document.required ?? []) {
		if (!(field in input.shape)) {
			throw new Error(`Required document field "${field}" is not a field of the input schema.`)
		}
	}
}

/** A document field is `-` for stdin, otherwise a path resolved against the working directory. */
export async function readDocument(
	ref: string,
	path: string,
	stdin: () => Promise<string>,
): Promise<string | AppError> {
	if (ref === "-") {
		try {
			return await stdin()
		} catch {
			return fail("invalid_input", {
				path,
				message: `${path}: the document could not be read from stdin`,
			})
		}
	}
	try {
		return readFileSync(ref, "utf8")
	} catch {
		return fail("invalid_input", {
			path,
			message: `${path}: cannot read the document at "${ref}"`,
		})
	}
}

/** Empty text is invalid input; JSON syntax and shape errors both name the document's field. */
export function parseDocument(spec: DocumentSpec, text: string, path: string): unknown | AppError {
	if (text.trim() === "") {
		return fail("invalid_input", { path, message: `${path}: the document is empty` })
	}
	let value: unknown
	try {
		value = JSON.parse(text)
	} catch {
		return fail("invalid_input", { path, message: `${path}: the document is not valid JSON` })
	}
	const result = spec.schema.safeParse(value, { reportInput: true })
	return result.success ? result.data : documentFailure(result.error)
}
