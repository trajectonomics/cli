import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { type AppError, fail, isAppError } from "../../errors"
import { IMPORT_HEADER, readImportCsv } from "../../tx/import-csv"
import { importRows } from "../../tx/import-run"
import { readSource } from "../../tx/import-source"
import { importResult } from "../../tx/import-view"
import { withStore } from "../../with-store"

type ImportFlags = {
	file?: string | undefined
	template?: boolean | undefined
	dryRun?: boolean | undefined
}

/** The forms are exclusive, and stdin is never inferred; the checks live here, not in a refine. */
function exclusive(input: ImportFlags): AppError | undefined {
	if (input.template === true && input.file !== undefined) {
		return fail("invalid_input", { path: "file", message: "file: --template takes no file" })
	}
	if (input.template === true && input.dryRun === true) {
		return fail("invalid_input", {
			path: "dryRun",
			message: "dryRun: --template takes no --dry-run",
		})
	}
	if (input.template !== true && input.file === undefined) {
		return fail("invalid_input", {
			path: "file",
			message: "file: name a CSV file, - for stdin, or --template",
			hint: 'Run "traj tx import --template" to print the template.',
		})
	}
	return undefined
}

export const importTx: Leaf = defineCommand({
	name: "import",
	summary: "Import transactions from the one CSV template",
	positionals: ["file"],
	input: z.strictObject({
		file: z
			.string()
			.min(1)
			.optional()
			.describe(`The CSV file to import, or - for stdin. Its header is exactly ${IMPORT_HEADER}.`),
		template: z.boolean().optional().describe("Print the CSV template and open no data directory."),
		dryRun: z.boolean().optional().describe("Report the import and roll every write back."),
	}),
	output: z.union([z.string(), importResult]),
	examples: [
		{ command: "traj tx import --template", description: "Print the one CSV template." },
		{ command: "traj tx import statement.csv", description: "Import a filled template." },
		{
			command: "traj tx import - --dry-run",
			description: "Preview a template read from stdin.",
		},
	],
	errorCodes: [
		"INVALID_ACCOUNT_HIERARCHY",
		"INVALID_AMOUNT",
		"CURRENCY_MISMATCH",
		"INVALID_CURRENCY",
		"INVALID_DATE",
		"INVALID_DIMENSION",
		"NEGATIVE_AMOUNT",
		"NON_LEAF_ACCOUNT",
		"UNBALANCED_TRANSACTION",
		"UNKNOWN_ACCOUNT",
		"ZERO_AMOUNT_POSTING",
		"account_archived",
		"database_busy",
		"external_ref_conflict",
		"invalid_input",
		"unsupported_currency",
	],
	run: async (input, ctx) => {
		const wrong = exclusive(input)
		if (wrong !== undefined) return wrong
		// The template is text only: it returns before the Store opens, so it creates no directory.
		if (input.template === true) return ok(IMPORT_HEADER)
		const file = input.file ?? "-"
		const text = await readSource(file, ctx.stdin)
		if (isAppError(text)) return text
		const rows = readImportCsv(text)
		if (isAppError(rows)) return rows
		return withStore(ctx, (store) => {
			const outcome = importRows(rows, file, input.dryRun === true, store)
			return isAppError(outcome) ? outcome : ok(outcome)
		})
	},
})
