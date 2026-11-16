import type { DocumentSpec, RequiredDocumentField } from "../command"
import { type AppError, fail } from "../errors"
import { scenarioDocument } from "./document"

/** The input fields `scenario apply` reads; the two forms share one input schema. */
export type ApplyFlags = {
	name?: string | undefined
	file?: string | undefined
	template?: boolean | undefined
	dryRun?: boolean | undefined
}

/** The document form cannot work without a name, and says so before it reads the document. */
export const REQUIRED_NAME: RequiredDocumentField = {
	field: "name",
	sentence: "name the Scenario to apply the document to",
}

export const DOCUMENT: DocumentSpec<typeof scenarioDocument> = {
	flag: "file",
	schema: scenarioDocument,
	allowed: ["name", "dryRun"],
	required: [REQUIRED_NAME],
}

/**
 * The forms are exclusive, and neither is inferred. The checks live in `run`, not in a refine, so
 * their paths and sentences stay CLI-owned; `--file` beside `--template` is refused earlier, by the
 * document form's own exclusivity check (ADR-0020, ADR-0033).
 */
export function exclusive(input: ApplyFlags): AppError | undefined {
	if (input.template === true && input.dryRun === true) {
		return fail("invalid_input", {
			path: "dryRun",
			message: "dryRun: --template takes no --dry-run",
		})
	}
	if (input.template === true && input.name !== undefined) {
		return fail("invalid_input", { path: "name", message: "name: --template takes no name" })
	}
	if (input.template !== true && input.file === undefined) {
		return fail("invalid_input", {
			path: "file",
			message: "file: name a JSON document, - for stdin, or --template",
			hint: 'Run "traj scenario apply --template" to print a document to start from.',
		})
	}
	return undefined
}
