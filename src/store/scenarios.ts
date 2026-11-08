import { type AppError, fail } from "../errors"
import { contentHash } from "./canonical"
import { liveOnly, SCENARIO_COLUMNS, SCENARIO_ORDER } from "./columns"
import type { Ctx } from "./context"
import { guard, write } from "./guard"
import { iso } from "./ids"
import { canonicalDocument, insertScenario, liveScenario, replaceDocument } from "./scenario-rows"
import type {
	ListOptions,
	NewScenario,
	ScenarioDeleted,
	ScenarioForked,
	ScenarioRow,
	ScenarioSaved,
	ScenarioSort,
} from "./types"

/** Creates the named scenario, or versions it when the canonical document changed. */
export function saveScenario(ctx: Ctx, input: NewScenario): ScenarioSaved | AppError {
	if (input.name === "") return fail("invalid_input", { path: "name", message: "name is empty" })
	return write(ctx.db, () => {
		const document = canonicalDocument(input.document)
		const current = liveScenario(ctx, "name", input.name)
		if (!current)
			return {
				status: "created",
				scenario: insertScenario(ctx, { name: input.name, document, forkedFrom: null }),
			}
		if (current.contentHash === contentHash(document))
			return { status: "unchanged", scenario: current }
		return { status: "updated", scenario: replaceDocument(ctx, current, document) }
	})
}

/** Copies a live scenario under a new name; the original keeps existing (ADR-0016). */
export function forkScenario(ctx: Ctx, id: string, name: string): ScenarioForked | AppError {
	if (name === "") return fail("invalid_input", { path: "name", message: "name is empty" })
	return write(ctx.db, () => {
		const source = liveScenario(ctx, "id", id)
		if (!source) return { status: "not_found" }
		const taken = liveScenario(ctx, "name", name)
		if (taken) return { status: "name_taken", scenario: taken }
		return {
			status: "forked",
			scenario: insertScenario(ctx, { name, document: source.document, forkedFrom: id }),
		}
	})
}

/** Tombstones a scenario: sync can then remove it elsewhere, and its name is free again. */
export function deleteScenario(ctx: Ctx, id: string): ScenarioDeleted | AppError {
	return write(ctx.db, () => {
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
	})
}

export function listScenarios(
	ctx: Ctx,
	options: ListOptions<ScenarioSort>,
): ScenarioRow[] | AppError {
	return guard(() =>
		ctx.db
			.query<ScenarioRow, [string]>(
				`SELECT ${SCENARIO_COLUMNS} FROM scenario WHERE entity_id = ?1
				${liveOnly(options.includeDeleted)} ORDER BY ${SCENARIO_ORDER[options.sort]}`,
			)
			.all(ctx.entityId),
	)
}
