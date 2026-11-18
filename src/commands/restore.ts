import { resolve } from "node:path"
import { z } from "zod"
import { readBackup } from "../backup/path"
import type { Leaf } from "../command"
import { defineCommand, ok } from "../command"
import { countsSchema } from "../counts"
import { isAppError } from "../errors"
import { importJsonl } from "../interchange"
import { withStore } from "../with-store"

/** What `traj restore` describes: the backup it read and the rows it wrote. */
export type RestoreResult = {
	database: string
	file: string
	rows: z.output<typeof countsSchema>
}

const restoreOutput: z.ZodType<RestoreResult> = z.strictObject({
	database: z.string().describe("The database the rows were written into."),
	file: z.string().describe("The backup file read, an absolute path."),
	rows: countsSchema.describe("Rows written per table, the seeded entity included."),
})

export const restore: Leaf = defineCommand({
	name: "restore",
	summary: "Write a backup's rows into an empty database",
	positionals: ["source"],
	input: z.strictObject({
		source: z
			.string()
			.min(1)
			.describe("A backup directory holding traj.jsonl, or that file's own path."),
	}),
	output: restoreOutput,
	examples: [
		{ command: "traj restore backup", description: "Restore a backup directory." },
		{
			command: "traj restore backup/traj.jsonl --json",
			description: "Restore the file itself and describe what was written.",
		},
	],
	// Every code a stored row can fail with: the interchange reader's, the restore's own, and
	// the ledger core's per-transaction validation (the ledger read's assembly codes cannot fire).
	errorCodes: [
		"backup_unreadable",
		"database_busy",
		"database_corrupt",
		"disk_full",
		"not_a_directory",
		"permission_denied",
		"database_too_new",
		"invalid_input",
		"migration_failed",
		"not_found",
		"restore_target_not_empty",
		"unsupported_currency",
		"CURRENCY_MISMATCH",
		"INVALID_ACCOUNT_HIERARCHY",
		"INVALID_AMOUNT",
		"INVALID_CURRENCY",
		"INVALID_DATE",
		"INVALID_DIMENSION",
		"NON_LEAF_ACCOUNT",
		"SINGLE_POSTING",
		"UNBALANCED_TRANSACTION",
		"UNKNOWN_ACCOUNT",
		"ZERO_AMOUNT_POSTING",
	],
	run: (input, ctx) => {
		// The backup is read before the store opens, so a missing one creates no data directory.
		const backup = readBackup(input.source, "source")
		if (isAppError(backup)) return backup
		return withStore(ctx, (store) => {
			const rows = importJsonl(backup.text, store)
			return isAppError(rows)
				? rows
				: ok({ database: resolve(store.path), file: backup.file, rows })
		})
	},
})
