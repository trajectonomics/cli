import type { z } from "zod"
import type { AppError } from "./errors"
import { documentPathOf, issueFailure, type Row } from "./invalid"
import { SENTENCES, sentenceOf } from "./sentences"

function paramsOf(issue: z.core.$ZodIssue): Record<string, unknown> {
	const params = "params" in issue ? issue.params : undefined
	return typeof params === "object" && params !== null ? (params as Record<string, unknown>) : {}
}

/** One row per validator issue; an unexpected key gets its own row, under its container. */
function documentRows(issue: z.core.$ZodIssue): Row[] {
	if (issue.code === "custom") {
		const code = paramsOf(issue)["code"]
		return [
			{
				path: documentPathOf(issue.path),
				message: issue.message,
				...(typeof code === "string" ? { code } : {}),
			},
		]
	}
	if (issue.code === "unrecognized_keys") {
		return issue.keys.map((key) => ({
			path: documentPathOf([...issue.path, key]),
			message: SENTENCES.unexpectedField,
		}))
	}
	return [{ path: documentPathOf(issue.path), message: sentenceOf(issue, "document") }]
}

/** The hint a core put on its first issue; it owns that sentence too (ADR-0024). */
function authoredHint(issue: z.core.$ZodIssue | undefined): string | undefined {
	if (issue?.code !== "custom") return undefined
	const hint = paramsOf(issue)["hint"]
	return typeof hint === "string" ? hint : undefined
}

/** The `invalid_input` a document's schema reports, under `document.` and never a flag. */
export function documentFailure(error: z.ZodError): AppError {
	return issueFailure(error.issues.flatMap(documentRows), authoredHint(error.issues[0]))
}
