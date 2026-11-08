import type { AccountInput, AccountType, ChartOfAccounts } from "@trajectonomics/ledger"
import { createChartOfAccounts, LedgerValidationError } from "@trajectonomics/ledger"
import type { Ctx } from "./context"

type ChartRow = { id: string; type: AccountType; currency: string; parentId: string | null }

function inputOf(ctx: Ctx, row: ChartRow): AccountInput {
	const parent = row.parentId === null ? {} : { parentId: row.parentId }
	return { id: row.id, type: row.type, currency: row.currency, entityId: ctx.entityId, ...parent }
}

/** `accounts[3].currency` → `currency` when index 3 is the caller's new account. */
function asCallerField(error: unknown, index: number): unknown {
	if (!(error instanceof LedgerValidationError)) return error
	const prefix = `accounts[${index}]`
	if (!error.field.startsWith(prefix)) return error
	const field = error.field.slice(prefix.length).replace(/^\./, "")
	return new LedgerValidationError(error.code, field, error.value, error.reason)
}

/**
 * The entity's chart: every non-tombstoned account, archived ones included, because leaving an
 * archived parent out would make its live children fail hierarchy validation. `extra` is a new
 * account checked alongside them. Throws the core's `LedgerValidationError`, which `guard` maps.
 */
export function chartOf(ctx: Ctx, extra?: AccountInput): ChartOfAccounts {
	const rows = ctx.db
		.query<ChartRow, [string]>(
			`SELECT id, type, currency, parent_id AS parentId FROM account
			WHERE entity_id = ?1 AND deleted_at IS NULL ORDER BY id`,
		)
		.all(ctx.entityId)
	const inputs = rows.map((row) => inputOf(ctx, row))
	try {
		return createChartOfAccounts(extra === undefined ? inputs : [...inputs, extra])
	} catch (error) {
		throw asCallerField(error, inputs.length)
	}
}
