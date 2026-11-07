import { fail } from "../errors"
import { canonicalJson, contentHash } from "./canonical"
import { SCENARIO_COLUMNS } from "./columns"
import type { Ctx } from "./context"
import { abort } from "./guard"
import { iso, newId } from "./ids"
import type { ScenarioRow } from "./types"

export function liveScenario(ctx: Ctx, column: "id" | "name", value: string): ScenarioRow | null {
	return ctx.db
		.query<ScenarioRow, [string, string]>(
			`SELECT ${SCENARIO_COLUMNS} FROM scenario
			WHERE entity_id = ?1 AND ${column} = ?2 AND deleted_at IS NULL`,
		)
		.get(ctx.entityId, value)
}

/**
 * The document as canonical text. `sim-core` does not exist, so a scenario is opaque apart from
 * being an object with an integer `schemaVersion`. Must run inside `guard`.
 */
export function canonicalDocument(document: unknown): string {
	const isObject = typeof document === "object" && document !== null && !Array.isArray(document)
	if (!isObject)
		return abort(
			fail("invalid_input", { path: "document", message: "document: must be a JSON object" }),
		)
	const version = (document as Record<string, unknown>)["schemaVersion"]
	if (!Number.isSafeInteger(version) || (version as number) < 1) {
		const path = "document.schemaVersion"
		return abort(fail("invalid_input", { path, message: `${path}: must be a positive integer` }))
	}
	return canonicalJson(document)
}

export type ScenarioDraft = { name: string; document: string; forkedFrom: string | null }

export function insertScenario(ctx: Ctx, draft: ScenarioDraft): ScenarioRow {
	const at = ctx.clock()
	const id = newId(at)
	ctx.db.run(
		`INSERT INTO scenario (id, entity_id, name, document, content_hash, forked_from, version,
		created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)`,
		[
			id,
			ctx.entityId,
			draft.name,
			draft.document,
			contentHash(draft.document),
			draft.forkedFrom,
			iso(at),
		],
	)
	return liveScenario(ctx, "id", id)!
}

export function replaceDocument(ctx: Ctx, current: ScenarioRow, document: string): ScenarioRow {
	ctx.db.run(
		`UPDATE scenario SET document = ?2, content_hash = ?3, version = version + 1, updated_at = ?4
		WHERE id = ?1`,
		[current.id, document, contentHash(document), iso(ctx.clock())],
	)
	return liveScenario(ctx, "id", current.id)!
}
