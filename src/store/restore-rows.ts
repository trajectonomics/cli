import { type AppError, fail } from "../errors"
import { supportedCurrency } from "./money"
import type { RestoreRows } from "./types"

const OWNED = ["account", "tx", "scenario"] as const

/** The first account or posting whose currency v1 does not support (ADR-0005). */
function unsupportedCurrency(rows: RestoreRows): AppError | null {
	for (const table of ["account", "posting"] as const) {
		for (const [index, row] of rows[table].entries()) {
			const failure = supportedCurrency(row.currency, `${table}.${index}.currency`)
			if (failure) return failure
		}
	}
	return null
}

/**
 * The restore's own shape rules, checked before any write: exactly one entity, the personal one,
 * every account, transaction and scenario owned by it, and THB as the only currency.
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
	return unsupportedCurrency(rows)
}
