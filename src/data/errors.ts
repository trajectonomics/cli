import { type AppError, fail } from "../errors"
import { type Inventory, lossSentence } from "./inventory"

/** What the refusal carries in `details`: the path, the size, and the rows that would go. */
function detailsOf(inventory: Inventory) {
	return {
		directory: inventory.directory,
		database: inventory.database,
		bytes: inventory.bytes,
		rows: inventory.rows,
	}
}

/** The one-line inventory a caller reads before deciding: what would be lost, and where. */
function loss(inventory: Inventory): string {
	const records = lossSentence(inventory.rows)
	return `${records} in ${inventory.directory} would be lost`
}

/** No `--confirm`: the command states what it would destroy and how to say yes. */
export function confirmRequired(inventory: Inventory): AppError {
	return fail("invalid_input", {
		path: "confirm",
		message: `confirm: ${loss(inventory)}; type that path with --confirm to delete the data`,
		hint: `Nothing was removed. Take a backup first: "traj backup --out <new dir>", then "traj data remove --confirm ${inventory.directory} --backup <backup dir>".`,
		details: detailsOf(inventory),
	})
}

/** A `--confirm` that names somewhere else: the caller has not read what is at stake. */
export function confirmMismatch(typed: string, inventory: Inventory): AppError {
	return fail("invalid_input", {
		path: "confirm",
		message: `confirm: "${typed}" is not ${inventory.directory}; ${loss(inventory)}`,
		hint: `Nothing was removed. Pass exactly --confirm ${inventory.directory}.`,
		details: detailsOf(inventory),
	})
}

/** No `--backup`: a removal without a restorable copy is refused, and the command says how. */
export function backupRequired(inventory: Inventory): AppError {
	return fail("invalid_input", {
		path: "backup",
		message: `backup: name the backup that holds a copy of ${lossSentence(inventory.rows)} in ${inventory.directory}`,
		hint: 'Nothing was removed. Run "traj backup --out <new dir>" first, then pass it as --backup.',
		details: detailsOf(inventory),
	})
}

/** The named backup does not hold the data as it is now, so restoring it would lose changes. */
export function backupStale(file: string): AppError {
	return fail("backup_stale", {
		path: "backup",
		message: `The backup does not match the data: ${file}`,
		hint: 'Nothing was removed. Run "traj backup --out <new dir>" again, so the copy holds every change, then retry.',
		details: { file },
	})
}

/** Nothing to remove: the data directory holds no database. */
export function noStoredData(database: string): AppError {
	return fail("not_found", {
		message: `No stored data at ${database}.`,
		hint: 'Run "traj doctor" to see what the data directory holds.',
		details: { database },
	})
}
