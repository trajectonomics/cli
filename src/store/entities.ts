import type { AppError } from "../errors"
import { ENTITY_COLUMNS, ENTITY_ORDER, liveOnly } from "./columns"
import type { Ctx } from "./context"
import { guard } from "./guard"
import type { EntityRow, EntitySort, ListOptions } from "./types"

/** Every entity row, or only the live ones, in the one declared order. */
export function listEntities(ctx: Ctx, options: ListOptions<EntitySort>): EntityRow[] | AppError {
	return guard(() =>
		ctx.db
			.query<EntityRow, []>(
				`SELECT ${ENTITY_COLUMNS} FROM entity WHERE 1 = 1 ${liveOnly(options.includeDeleted)}
				ORDER BY ${ENTITY_ORDER[options.sort]}`,
			)
			.all(),
	)
}
