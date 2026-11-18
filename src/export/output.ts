import { z } from "zod"
import { countsSchema } from "../counts"
import { EXPORT_FORMATS, type ExportFormat } from "./files"
import type { DumpWritten } from "./run"

/** What `traj export` describes after writing: the format beside the dump it wrote. */
export type ExportResult = DumpWritten & { format: ExportFormat }

export const exportOutput: z.ZodType<ExportResult> = z.strictObject({
	format: z
		.enum(EXPORT_FORMATS)
		.describe("The file format written; --json only changes this Result's envelope."),
	directory: z.string().describe("The absolute path of the directory written."),
	schemaVersion: z.number().int().describe("The database's schema version."),
	files: z
		.array(z.string())
		.describe("The files written, relative to directory, in the export's record order."),
	rows: countsSchema,
})
