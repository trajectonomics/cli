import { type AppError, fail } from "../errors"
import type { RestoreRows } from "./types"

const OWNED = ["account", "tx", "scenario"] as const

/**
 * The restore's own shape rules, checked before any write: exactly one entity, the personal one,
 * and every account, transaction and scenario owned by it.
 */
export function checkRows(entityId: string, rows: RestoreRows): AppError | null {
	const [entity, ...more] = rows.entity
	if (entity === undefined || more.length > 0 || entity.id !== entityId) {
		const message = `entity: a restore holds exactly one entity, the personal entity ${entityId}`
		return fail("invalid_input", {
			path: "entity",
			message,
			details: { ids: rows.entity.map((row) => row.id) },
		})
	}
	for (const table of OWNED) {
		const index = rows[table].findIndex((row) => row.entityId !== entityId)
		if (index === -1) continue
		const path = `${table}.${index}.entityId`
		return fail("invalid_input", {
			path,
			message: `${path}: must be the personal entity ${entityId}`,
		})
	}
	return null
}
