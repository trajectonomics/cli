import { z } from "zod"
import type { TxAdded } from "../store"
import { viewTransactionBody, type WrittenTransactionBody, writtenTransactionBody } from "./view"

/** One row of a successful import, in file order. */
export type ImportedRow = {
	line: number
	status: "added" | "duplicate"
	externalRef: string
	transaction: WrittenTransactionBody
}

/** The one success shape of `tx import FILE.csv`; a rejected import is an error envelope. */
export type ImportResult = {
	dryRun: boolean
	file: string
	rows: ImportedRow[]
	counts: { added: number; duplicate: number; rejected: 0 }
}

/** Where a CSV row sits, which the store does not know: its line and its reference cell. */
export type ImportPosition = { line: number; externalRef: string }

const importedRow: z.ZodType<ImportedRow> = z.strictObject({
	line: z.number().int().describe("The physical CSV line the row starts on."),
	status: z.enum(["added", "duplicate"]).describe("What the import did with the row."),
	externalRef: z.string().describe("The row's external reference, its idempotency key."),
	transaction: writtenTransactionBody,
})

export const importResult: z.ZodType<ImportResult> = z.strictObject({
	dryRun: z.boolean().describe("True when every write was rolled back."),
	file: z.string().describe("The CSV path as given, or - for stdin."),
	rows: z.array(importedRow).describe("One entry per data row, in file order."),
	counts: z.strictObject({
		added: z.number().int().describe("Rows this import added."),
		duplicate: z.number().int().describe("Rows whose reference already held identical content."),
		rejected: z.literal(0).describe("Always 0: a rejected import is an error, not a result."),
	}),
})

/**
 * The rows the batch wrote, paired with the CSV positions it was given. Under a dry run every id
 * the batch minted is null, including a duplicate of an earlier row of the same import; a
 * duplicate of a stored row keeps its id (ADR-0019).
 */
export function viewImport(
	written: readonly TxAdded[],
	positions: readonly ImportPosition[],
	file: string,
	dryRun: boolean,
): ImportResult {
	if (written.length !== positions.length) {
		throw new Error(`the store wrote ${written.length} rows for ${positions.length} CSV rows`)
	}
	const minted = new Set(written.filter((row) => row.status === "added").map((row) => row.tx.id))
	const rows = written.map((row, at): ImportedRow => {
		const position = positions[at]!
		const rolledBack = dryRun && (row.status === "added" || minted.has(row.tx.id))
		return {
			line: position.line,
			status: row.status,
			externalRef: position.externalRef,
			transaction: viewTransactionBody(row, rolledBack),
		}
	})
	return {
		dryRun,
		file,
		rows,
		counts: {
			added: rows.filter((row) => row.status === "added").length,
			duplicate: rows.filter((row) => row.status === "duplicate").length,
			rejected: 0,
		},
	}
}
