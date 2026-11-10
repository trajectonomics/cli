import { type AppError, fail } from "../errors"
import { contentHash } from "./canonical"
import { liveOnly, SCENARIO_COLUMNS, SCENARIO_ORDER } from "./columns"
import type { Ctx } from "./context"
import { guard, write } from "./guard"
import { canonicalDocument, insertScenario, liveScenario, replaceDocument } from "./scenario-rows"
import type {
	ListOptions,
	NewScenario,
	ScenarioRow,
	ScenarioSaved,
	ScenarioSort,
	WriteOptions,
} from "./types"

/** The live Scenario this id or name names; an id is read first (ADR-0018). */
export function getScenario(ctx: Ctx, idOrName: string): ScenarioRow | null | AppError {
	return guard(() => liveScenario(ctx, "id", idOrName) ?? liveScenario(ctx, "name", idOrName))
}

/** Creates the named scenario, or versions it when the canonical document changed. */
export function saveScenario(
	ctx: Ctx,
	input: NewScenario,
	options: WriteOptions = {},
): ScenarioSaved | AppError {
	if (input.name === "") return fail("invalid_input", { path: "name", message: "name is empty" })
	return write(
		ctx.db,
		() => {
			const document = canonicalDocument(input.document)
			const current = liveScenario(ctx, "name", input.name)
			if (!current) {
				return {
					status: "created",
					scenario: insertScenario(ctx, { name: input.name, document, forkedFrom: null }),
				}
			}
			if (current.contentHash === contentHash(document)) {
				return { status: "unchanged", scenario: current }
			}
			return { status: "updated", scenario: replaceDocument(ctx, current, document) }
		},
		options,
	)
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
