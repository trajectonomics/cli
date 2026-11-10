import type { AppError } from "../errors"
import { closeAccount, deleteAccount } from "./account-lifecycle"
import { createAccount, getAccount, listAccounts, listChildAccounts } from "./accounts"
import { chartOf } from "./chart"
import { ENTITY_COLUMNS, ENTITY_ORDER, liveOnly } from "./columns"
import type { Ctx } from "./context"
import { guard } from "./guard"
import { userVersion } from "./migrations"
import { restore } from "./restore"
import { deleteScenario } from "./scenario-delete"
import { forkScenario } from "./scenario-fork"
import { getScenario, listScenarios, saveScenario } from "./scenarios"
import { addTransaction } from "./transactions"
import { amendTransaction } from "./tx-amend"
import { importTransactions } from "./tx-import"
import { getTransaction, listPostings, listTransactions } from "./tx-reads"
import { voidTransaction } from "./tx-void"
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
		chart: () => guard(() => chartOf(ctx)),
		listEntities: (options) => listEntities(ctx, options),
		createAccount: (input, options) => createAccount(ctx, input, options),
		listAccounts: (options) => listAccounts(ctx, options),
		getAccount: (idOrName) => getAccount(ctx, idOrName),
		listChildAccounts: (parentId) => listChildAccounts(ctx, parentId),
		closeAccount: (id, options) => closeAccount(ctx, id, options),
		deleteAccount: (id) => deleteAccount(ctx, id),
		addTransaction: (input, options) => addTransaction(ctx, input, options),
		importTransactions: (inputs, options) => importTransactions(ctx, inputs, options),
		voidTransaction: (id, input, options) => voidTransaction(ctx, id, input, options),
		amendTransaction: (id, input, options) => amendTransaction(ctx, id, input, options),
		listTransactions: (options) => listTransactions(ctx, options),
		getTransaction: (id) => getTransaction(ctx, id),
		listPostings: (options) => listPostings(ctx, options),
		saveScenario: (input, options) => saveScenario(ctx, input, options),
		forkScenario: (id, name, options) => forkScenario(ctx, id, name, options),
		deleteScenario: (id, options) => deleteScenario(ctx, id, options),
		getScenario: (idOrName) => getScenario(ctx, idOrName),
		listScenarios: (options) => listScenarios(ctx, options),
		restore: (rows) => restore(ctx, rows),
		close: () => ctx.db.close(),
	}
}
