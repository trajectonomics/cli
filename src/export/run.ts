import { resolve } from "node:path"
import type { Context } from "../command"
import { ok } from "../command"
import { countsOf, viewDump } from "../dump/view"
import { type AppError, isAppError } from "../errors"
import type { RestoreCounts } from "../store"
import { withStore } from "../with-store"
import { type ExportFormat, exportFiles } from "./files"
import { writeExport } from "./write"

/** What one written dump directory holds, whichever command asked for it. */
export type DumpWritten = {
	directory: string
	schemaVersion: number
	files: string[]
	rows: RestoreCounts
}

/**
 * Reads one dump inside the store, closes it, then writes the format's files into a directory
 * created at `out`. `backup` and `export` share this, so the two can never write different bytes
 * for the same format: `jsonl` is the one file `restore` reads.
 */
export async function writeDumpExport(
	ctx: Context,
	format: ExportFormat,
	out: string,
	what: "backup" | "export",
): Promise<DumpWritten | AppError> {
	const read = withStore(ctx, (store) => {
		const schemaVersion = store.schemaVersion()
		if (isAppError(schemaVersion)) return schemaVersion
		const rows = store.dump()
		if (isAppError(rows)) return rows
		const files = exportFiles(format, schemaVersion, viewDump(rows))
		return ok({ schemaVersion, files, counts: countsOf(rows) })
	})
	if (isAppError(read)) return read
	const { schemaVersion, files, counts } = read.data
	const failure = await writeExport(out, files, what)
	if (failure) return failure
	return {
		directory: resolve(out),
		schemaVersion,
		files: files.map((file) => file.name),
		rows: counts,
	}
}
