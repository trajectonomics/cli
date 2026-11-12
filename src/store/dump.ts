import { type AppError, isAppError } from "../errors"
import { listAccounts } from "./accounts"
import type { Ctx } from "./context"
import { listEntities } from "./entities"
import { abort, guard } from "./guard"
import { listScenarios } from "./scenarios"
import { listPostings, listTransactions } from "./tx-reads"
import type { RestoreCounts, RestoreRows } from "./types"

/** Every table's rows, read one table at a time inside the caller's transaction. */
function readAll(ctx: Ctx): RestoreRows | AppError {
	const entity = listEntities(ctx, { sort: "id", includeDeleted: true })
	if (isAppError(entity)) return entity
	const account = listAccounts(ctx, { sort: "id", includeDeleted: true })
	if (isAppError(account)) return account
	const tx = listTransactions(ctx, { sort: "date" })
	if (isAppError(tx)) return tx
	const posting = listPostings(ctx, { sort: "tx_id" })
	if (isAppError(posting)) return posting
	const scenario = listScenarios(ctx, { sort: "id", includeDeleted: true })
	if (isAppError(scenario)) return scenario
	return { entity, account, tx, posting, scenario }
}

/**
 * Every row of every table, tombstones included, in the canonical order the export writes:
 * entity by id, account by id, tx by date then id, posting by tx then ordinal, scenario by id.
 * All five reads run inside one deferred read transaction, so a writer committing between two
 * of them cannot produce a posting whose transaction is missing from the same dump.
 */
export function dumpRows(ctx: Ctx): RestoreRows | AppError {
	return guard(() =>
		ctx.db
			.transaction(() => {
				const rows = readAll(ctx)
				if (isAppError(rows)) abort(rows)
				return rows
			})
			.deferred(),
	)
}

/**
 * Each table's row count, tombstones included, in one statement of five subqueries, so a bare
 * summary never reads every row. The numbers are the dump's own row counts.
 */
export function dumpCounts(ctx: Ctx): RestoreCounts | AppError {
	return guard(
		() =>
			ctx.db
				.query<RestoreCounts, [string]>(
					`SELECT (SELECT count(*) FROM entity) AS entity,
					(SELECT count(*) FROM account WHERE entity_id = ?1) AS account,
					(SELECT count(*) FROM tx WHERE entity_id = ?1) AS tx,
					(SELECT count(*) FROM posting
						WHERE tx_id IN (SELECT id FROM tx WHERE entity_id = ?1)) AS posting,
					(SELECT count(*) FROM scenario WHERE entity_id = ?1) AS scenario`,
				)
				.get(ctx.entityId)!,
	)
}
