import type { AppError } from "../errors"
import { closeAccount, deleteAccount } from "./account-lifecycle"
import { createAccount, listAccounts } from "./accounts"
import { ENTITY_COLUMNS, ENTITY_ORDER, liveOnly } from "./columns"
import type { Ctx } from "./context"
import { guard } from "./guard"
import { userVersion } from "./migrations"
import { restore } from "./restore"
import { deleteScenario, forkScenario, listScenarios, saveScenario } from "./scenarios"
import { addTransaction, listPostings, listTransactions } from "./transactions"
import type { EntityRow, EntitySort, ListOptions, Store } from "./types"

function listEntities(ctx: Ctx, options: ListOptions<EntitySort>): EntityRow[] | AppError {
	return guard(() =>
		ctx.db
			.query<EntityRow, []>(
				`SELECT ${ENTITY_COLUMNS} FROM entity WHERE 1 = 1 ${liveOnly(options.includeDeleted)}
				ORDER BY ${ENTITY_ORDER[options.sort]}`,
			)
			.all(),
	)
}

/** Binds every operation to one connection, clock and entity. */
export function storeOver(path: string, ctx: Ctx): Store {
	return {
		path,
		entityId: ctx.entityId,
		schemaVersion: () => guard(() => userVersion(ctx.db)),
		listEntities: (options) => listEntities(ctx, options),
		createAccount: (input) => createAccount(ctx, input),
		listAccounts: (options) => listAccounts(ctx, options),
		closeAccount: (id) => closeAccount(ctx, id),
		deleteAccount: (id) => deleteAccount(ctx, id),
		addTransaction: (input) => addTransaction(ctx, input),
		listTransactions: (options) => listTransactions(ctx, options),
		listPostings: (options) => listPostings(ctx, options),
		saveScenario: (input) => saveScenario(ctx, input),
		forkScenario: (id, name) => forkScenario(ctx, id, name),
		deleteScenario: (id) => deleteScenario(ctx, id),
		listScenarios: (options) => listScenarios(ctx, options),
		restore: (rows) => restore(ctx, rows),
		close: () => ctx.db.close(),
	}
}
