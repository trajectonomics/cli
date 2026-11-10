import type { DumpRows } from "../dump/view"
import { jsonlText } from "../interchange/write"

/** The file formats `--format` chooses; the Result's Format is a separate axis. */
export const EXPORT_FORMATS = ["jsonl"] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

/** One file of an export: its name relative to the export directory, and its exact bytes. */
export type ExportFile = { name: string; contents: string }

/**
 * The files one export writes, in record order, from the one dump it read. JSONL is the
 * canonical, restorable copy; a later ticket adds the CSV and Markdown human copies.
 */
export function exportFiles(
	format: ExportFormat,
	schemaVersion: number,
	rows: DumpRows,
): readonly ExportFile[] {
	switch (format) {
		case "jsonl":
			return [{ name: "traj.jsonl", contents: jsonlText(schemaVersion, rows) }]
	}
}
