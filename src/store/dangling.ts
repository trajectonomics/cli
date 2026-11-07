import type { Database } from "bun:sqlite"
import { type AppError, fail } from "../errors"

type Violation = { table: string; parent: string; fkid: number }
type ForeignKey = { id: number; table: string; from: string; to: string | null }
type Dangling = { table: string; column: string; parent: string; missing: string }

/** The values of `table.from` that `foreign_key_check` found pointing at no row of the parent. */
function missingValues(db: Database, table: string, key: ForeignKey): Dangling[] {
	const to = key.to ?? "id"
	return db
		.query<{ missing: string }, []>(
			`SELECT DISTINCT ${key.from} AS missing FROM ${table} WHERE ${key.from} IS NOT NULL
			AND ${key.from} NOT IN (SELECT ${to} FROM ${key.table}) ORDER BY missing`,
		)
		.all()
		.map(({ missing }) => ({ table, column: key.from, parent: key.table, missing }))
}

/**
 * Runs `PRAGMA foreign_key_check` (the check deferred keys postpone to commit) and names every
 * dangling reference, or returns null when there is none.
 */
export function danglingReferences(db: Database): AppError | null {
	const violations = db.query<Violation, []>("PRAGMA foreign_key_check").all()
	if (violations.length === 0) return null
	const seen = new Set(violations.map((v) => `${v.table}\u0000${v.fkid}`))
	const dangling = [...seen].flatMap((pair) => {
		const [table = "", fkid] = pair.split("\u0000")
		const keys = db.query<ForeignKey, []>(`PRAGMA foreign_key_list(${table})`).all()
		const key = keys.find((k) => k.id === Number(fkid))
		return key ? missingValues(db, table, key) : []
	})
	const list = dangling.map((d) => `${d.table}.${d.column} → ${d.missing}`).join(", ")
	return fail("invalid_input", {
		message: `The import would leave ${dangling.length} dangling reference(s): ${list}.`,
		details: { dangling },
	})
}
