import type { DumpRows } from "../dump/view"
import { jsonlText } from "../interchange/write"
import { csvFiles } from "./csv"
import { markdownFile } from "./markdown"

/** The file formats `--format` chooses; the Result's Format is a separate axis. */
export const EXPORT_FORMATS = ["jsonl", "csv", "md"] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

/** One file of an export: its name relative to the export directory, and its exact bytes. */
export type ExportFile = { name: string; contents: string }

/**
 * The files one export writes, in record order, from the one dump it read. JSONL is the
 * canonical, restorable copy; CSV and Markdown are human copies of the same rows.
 */
export function exportFiles(
	format: ExportFormat,
	schemaVersion: number,
	rows: DumpRows,
): readonly ExportFile[] {
	switch (format) {
		case "jsonl":
			return [{ name: "traj.jsonl", contents: jsonlText(schemaVersion, rows) }]
		case "csv":
			return csvFiles(rows)
		case "md":
			return [markdownFile(rows)]
	}
}
