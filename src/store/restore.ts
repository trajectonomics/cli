import { SQLiteError } from "bun:sqlite"
import { type AppError, fail } from "../errors"
import type { Ctx } from "./context"
import { danglingReferences } from "./dangling"
import { abort, write } from "./guard"
import { INSERTS, type Table } from "./restore-sql"
import type { RestoreCounts, RestoreRows } from "./types"

const TABLES = Object.keys(INSERTS) as Table[]

function notEmpty(ctx: Ctx): AppError | null {
	const { rows } = ctx.db
		.query<{ rows: number }, [string]>(
			`SELECT (SELECT count(*) FROM entity WHERE id <> ?1) + (SELECT count(*) FROM account)
			+ (SELECT count(*) FROM tx) + (SELECT count(*) FROM scenario) AS rows`,
		)
		.get(ctx.entityId)!
	if (rows === 0) return null
	const message = "The target database already holds data; restore only into a new database."
	return fail("invalid_input", { message, details: { rows } })
}

function insertAll<T extends Table>(ctx: Ctx, table: T, rows: RestoreRows[T]): void {
	const { sql, values } = INSERTS[table]
	const statement = ctx.db.query(sql)
	try {
		for (const row of rows) statement.run(...values(row))
	} catch (error) {
		if (!(error instanceof SQLiteError && error.code?.startsWith("SQLITE_CONSTRAINT"))) throw error
		abort(fail("invalid_input", { path: table, message: `${table}: ${error.message}` }))
	}
}

export function restore(ctx: Ctx, rows: RestoreRows): RestoreCounts | AppError {
	return write(ctx.db, () => {
		const occupied = notEmpty(ctx)
		if (occupied) return occupied
		ctx.db.run("PRAGMA defer_foreign_keys = ON")
		for (const table of TABLES) insertAll(ctx, table, rows[table])
		const dangling = danglingReferences(ctx.db)
		if (dangling) return dangling
		return Object.fromEntries(TABLES.map((t) => [t, rows[t].length])) as RestoreCounts
	})
}
