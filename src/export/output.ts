import { z } from "zod"
import type { RestoreCounts } from "../store"
import { EXPORT_FORMATS, type ExportFormat } from "./files"

/** What `traj export` describes after writing: the format, the path, the files and the counts. */
export type ExportResult = {
	format: ExportFormat
	directory: string
	schemaVersion: number
	files: string[]
	rows: RestoreCounts
}

const count = (table: string) => z.number().int().describe(`Rows written to the ${table} file.`)

export const exportOutput: z.ZodType<ExportResult> = z.strictObject({
	format: z
		.enum(EXPORT_FORMATS)
		.describe("The file format written; --json only changes this Result's envelope."),
	directory: z.string().describe("The absolute path of the directory written."),
	schemaVersion: z.number().int().describe("The database's schema version."),
	files: z
		.array(z.string())
		.describe("The files written, relative to directory, in the export's record order."),
	rows: z
		.strictObject({
			entity: count("entity"),
			account: count("account"),
			tx: count("tx"),
			posting: count("posting"),
			scenario: count("scenario"),
		})
		.describe("Rows written per table, tombstones included."),
})
