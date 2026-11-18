import { z } from "zod"
import { countsSchema } from "../counts"
import type { DumpWritten } from "../export/run"

/** What `traj backup` describes: the directory, the one file in it, and the rows it holds. */
export const backupOutput: z.ZodType<DumpWritten> = z.strictObject({
	directory: z.string().describe("The absolute path of the directory written."),
	schemaVersion: z
		.number()
		.int()
		.describe("The database's schema version, as the header states it."),
	files: z.array(z.string()).describe("The files written, relative to directory."),
	rows: countsSchema,
})
