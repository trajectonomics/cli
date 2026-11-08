import type { Database } from "bun:sqlite"

/**
 * Version 2: `tx.correction_kind` names what a linked row is, so an amendment's reversal is never
 * read as its replacement (ADR-0016, ADR-0021). Before this step the only linked row a command
 * wrote was a void's reversal, so existing links are filled in as reversals.
 */
export function schemaV2(db: Database): void {
	db.run(
		`ALTER TABLE tx ADD COLUMN correction_kind TEXT
		CHECK (correction_kind IN ('reversal', 'replacement'))`,
	)
	db.run("UPDATE tx SET correction_kind = 'reversal' WHERE linked_to IS NOT NULL")
}
