import { existsSync, unlinkSync } from "node:fs"
import { join, resolve } from "node:path"
import { z } from "zod"
import { readBackup } from "../../backup/path"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { countsSchema } from "../../counts"
import {
	backupRequired,
	backupStale,
	confirmMismatch,
	confirmRequired,
	noStoredData,
} from "../../data/errors"
import { inventoryOf, remainingOf } from "../../data/inventory"
import { DATABASE_FILE, dataDirectory } from "../../data-directory"
import { isAppError } from "../../errors"
import { directoryStep } from "../../store/io-steps"
import { withStore } from "../../with-store"

const removedOutput = z.strictObject({
	directory: z.string().describe("The data directory the database was removed from."),
	database: z.string().describe("The database file removed, an absolute path."),
	backup: z.string().describe("The backup file that held a copy of the removed data."),
	removed: z.array(z.string()).describe("Every file removed, absolute paths."),
	kept: z.array(z.string()).describe("What remains in the data directory, sorted by name."),
	rows: countsSchema.describe("Rows that were removed, tombstones included."),
})

export const remove: Leaf = defineCommand({
	name: "remove",
	summary: "Delete the stored data, and nothing else in the data directory",
	positionals: [],
	input: z.strictObject({
		confirm: z
			.string()
			.min(1)
			.optional()
			.describe("The data directory's own path, typed to confirm the deletion."),
		backup: z
			.string()
			.min(1)
			.optional()
			.describe("A backup directory, or its traj.jsonl, holding a copy of the data as it is now."),
	}),
	output: removedOutput,
	examples: [
		{ command: "traj data remove", description: "Refuse, and print what the removal would lose." },
		{
			command: "traj data remove --confirm ~/.traj --backup backup",
			description: "Delete traj.db after checking the backup holds every row.",
		},
	],
	errorCodes: [
		"backup_stale",
		"backup_unreadable",
		"database_busy",
		"database_corrupt",
		"database_too_new",
		"disk_full",
		"invalid_input",
		"migration_failed",
		"not_a_directory",
		"not_found",
		"permission_denied",
	],
	run: (input, ctx) => {
		const database = join(dataDirectory(ctx.env), DATABASE_FILE)
		// It reports what it would delete, including nothing, rather than the store's ledger_missing.
		if (!existsSync(database)) return noStoredData(database)
		const read = withStore(ctx, (store) => {
			const inventory = inventoryOf(store)
			return isAppError(inventory) ? inventory : ok(inventory)
		})
		if (isAppError(read)) return read
		const inventory = read.data
		if (input.confirm === undefined) return confirmRequired(inventory)
		if (resolve(input.confirm) !== inventory.directory) {
			return confirmMismatch(input.confirm, inventory)
		}
		if (input.backup === undefined) return backupRequired(inventory)
		const backup = readBackup(input.backup, "backup")
		if (isAppError(backup)) return backup
		// The backup must hold exactly the data being deleted, so a restore loses no write.
		if (backup.text !== inventory.current) return backupStale(backup.file)
		// Closing the store checkpoints the write-ahead log, so a sidecar read while it was open
		// may already be gone; the report names the files that were actually removed.
		const removed = inventory.files.filter((file) => existsSync(file))
		const kept = directoryStep(inventory.directory, () => {
			for (const file of removed) unlinkSync(file)
			return remainingOf(inventory.directory)
		})
		if (isAppError(kept)) return kept
		return ok({
			directory: inventory.directory,
			database: inventory.database,
			backup: backup.file,
			removed,
			kept,
			rows: inventory.rows,
		})
	},
})
