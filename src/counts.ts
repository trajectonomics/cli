import { z } from "zod"
import type { RestoreCounts } from "./store"

/**
 * One count per table, tombstones included: the shape the export, the backup, the restore and
 * the removal all report, so a caller compares them without translating between commands.
 */
export const countsSchema: z.ZodType<RestoreCounts> = z
	.strictObject({
		entity: z.number().int().describe("Rows in the entity table, tombstones included."),
		account: z.number().int().describe("Rows in the account table, tombstones included."),
		tx: z.number().int().describe("Rows in the tx table, tombstones included."),
		posting: z.number().int().describe("Rows in the posting table, tombstones included."),
		scenario: z.number().int().describe("Rows in the scenario table, tombstones included."),
	})
	.describe("One count per table, in the dump's record order.")

/** `1 transaction`, `2 transactions`: a count read aloud in a sentence. */
export function counted(count: number, noun: string): string {
	return `${count} ${noun}${count === 1 ? "" : "s"}`
}
