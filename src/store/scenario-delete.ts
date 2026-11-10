import type { AppError } from "../errors"
import type { Ctx } from "./context"
import { write } from "./guard"
import { iso } from "./ids"
import { liveScenario } from "./scenario-rows"
import type { ScenarioDeleted, WriteOptions } from "./types"

/** Tombstones a scenario: sync can then remove it elsewhere, and its name is free again. */
export function deleteScenario(
	ctx: Ctx,
	id: string,
	options: WriteOptions = {},
): ScenarioDeleted | AppError {
	return write(
		ctx.db,
		() => {
			const scenario = liveScenario(ctx, "id", id)
			if (!scenario) return { status: "not_found" }
			const at = iso(ctx.clock())
			ctx.db.run(
				"UPDATE scenario SET deleted_at = ?2, version = version + 1, updated_at = ?2 WHERE id = ?1",
				[id, at],
			)
			return {
				status: "deleted",
				scenario: { ...scenario, version: scenario.version + 1, updatedAt: at, deletedAt: at },
			}
		},
		options,
	)
}
