import { existsSync, readdirSync, statSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { counted } from "../counts"
import { countsOf, viewDump } from "../dump/view"
import { type AppError, isAppError } from "../errors"
import { jsonlText } from "../interchange/write"
import type { RestoreCounts, Store } from "../store"

/** Everything a guarded removal reports and checks, before it deletes anything. */
export type Inventory = {
	directory: string
	database: string
	/** The database file's size in bytes. */
	bytes: number
	rows: RestoreCounts
	/** The canonical JSONL the data holds now; a backup holding these bytes proves a copy exists. */
	current: string
	/** The files the removal deletes, sidecars first and the database last. */
	files: string[]
}

/**
 * The sidecar files SQLite keeps beside the database while it is open, then the database itself.
 * The database goes last, so a removal that fails part way has not removed what holds the data.
 */
function filesOf(database: string): string[] {
	return [`${database}-shm`, `${database}-wal`, database].filter((file) => existsSync(file))
}

/** Reads the dump once: the counts, the bytes a backup must match, and which files go. */
export function inventoryOf(store: Store): Inventory | AppError {
	const schemaVersion = store.schemaVersion()
	if (isAppError(schemaVersion)) return schemaVersion
	const rows = store.dump()
	if (isAppError(rows)) return rows
	const database = resolve(store.path)
	return {
		directory: dirname(database),
		database,
		bytes: existsSync(database) ? statSync(database).size : 0,
		rows: countsOf(rows),
		current: jsonlText(schemaVersion, viewDump(rows)),
		files: filesOf(database),
	}
}

const PART = [
	["tx", "transaction"],
	["posting", "posting"],
	["account", "account"],
	["scenario", "scenario"],
] as const

/** The rows one removal would lose, in plain words: `4 transactions, 8 postings and 7 accounts`. */
export function lossSentence(rows: RestoreCounts): string {
	const parts = PART.filter(([table]) => rows[table] > 0).map(([table, noun]) =>
		counted(rows[table], noun),
	)
	const [first, ...rest] = parts
	if (first === undefined) return "no records"
	return rest.length === 0 ? first : `${parts.slice(0, -1).join(", ")} and ${rest.at(-1)}`
}

/** What is left in the data directory after the database files go, sorted so it is stable. */
export function remainingOf(directory: string): string[] {
	return readdirSync(directory).sort()
}
