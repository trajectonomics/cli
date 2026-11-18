import type { AppError } from "../errors"
import type { Ctx } from "./context"
import { read } from "./guard"

/**
 * `PRAGMA integrity_check`, the database's own verdict on its pages and indexes. A healthy
 * database answers with the single row `ok`; anything else is SQLite's own finding, kept verbatim
 * because it names the page or index at fault and nothing here can improve on that.
 */
export function integrityOf(ctx: Ctx): string[] | AppError {
	return read(ctx.db, () =>
		ctx.db
			.query<{ integrity_check: string }, []>("PRAGMA integrity_check")
			.all()
			.map((row) => row.integrity_check),
	)
}
