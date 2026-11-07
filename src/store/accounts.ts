import type { AccountType } from "@trajectonomics/ledger"
import { type AppError, fail } from "../errors"
import { chartOf } from "./chart"
import { ACCOUNT_COLUMNS, ACCOUNT_ORDER, liveOnly } from "./columns"
import type { Ctx } from "./context"
import { guard, write } from "./guard"
import { iso, newId } from "./ids"
import { supportedCurrency } from "./money"
import type { AccountCreated, AccountRow, AccountSort, ListOptions, NewAccount } from "./types"

/** The live (non-tombstoned) account with this id in the entity, if any. */
export function liveAccount(ctx: Ctx, id: string): AccountRow | null {
	return ctx.db
		.query<AccountRow, [string, string]>(
			`SELECT ${ACCOUNT_COLUMNS} FROM account
			WHERE id = ?1 AND entity_id = ?2 AND deleted_at IS NULL`,
		)
		.get(id, ctx.entityId)
}

function liveByName(ctx: Ctx, name: string): AccountRow | null {
	return ctx.db
		.query<AccountRow, [string, string]>(
			`SELECT ${ACCOUNT_COLUMNS} FROM account
			WHERE entity_id = ?1 AND name = ?2 AND deleted_at IS NULL`,
		)
		.get(ctx.entityId, name)
}

function insert(ctx: Ctx, input: NewAccount): AccountRow {
	const at = ctx.clock()
	const id = newId(at)
	const parent = input.parentId === undefined ? {} : { parentId: input.parentId }
	const { type, currency } = input
	chartOf(ctx, { id, type, currency, entityId: ctx.entityId, ...parent })
	ctx.db.run(
		`INSERT INTO account (id, entity_id, name, type, currency, parent_id, version, created_at,
		updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, ?7)`,
		[id, ctx.entityId, input.name, type, currency, input.parentId ?? null, iso(at)],
	)
	return liveAccount(ctx, id)!
}

// Keyed by the core's type, so a type the core adds fails typecheck until it is listed here.
const TYPES: Record<AccountType, null> = {
	asset: null,
	liability: null,
	equity: null,
	income: null,
	expense: null,
}

/**
 * Every account type, in a fixed order. The core types `type` but does not check it at runtime,
 * so the store and the importer do. The schema's CHECK constraint is the database's own copy.
 */
export const ACCOUNT_TYPES = Object.keys(TYPES) as readonly AccountType[]

export function isAccountType(value: unknown): value is AccountType {
	return typeof value === "string" && Object.hasOwn(TYPES, value)
}

export function createAccount(ctx: Ctx, input: NewAccount): AccountCreated | AppError {
	if (input.name === "") return fail("invalid_input", { path: "name", message: "name is empty" })
	if (!isAccountType(input.type)) {
		const message = `type: must be one of ${ACCOUNT_TYPES.join(", ")}`
		return fail("invalid_input", { path: "type", message })
	}
	const currency = supportedCurrency(input.currency)
	if (currency) return currency
	return write(ctx.db, () => {
		const taken = liveByName(ctx, input.name)
		if (taken) return { status: "name_taken", account: taken }
		return { status: "created", account: insert(ctx, input) }
	})
}

export function listAccounts(ctx: Ctx, options: ListOptions<AccountSort>): AccountRow[] | AppError {
	return guard(() =>
		ctx.db
			.query<AccountRow, [string]>(
				`SELECT ${ACCOUNT_COLUMNS} FROM account WHERE entity_id = ?1
				${liveOnly(options.includeDeleted)} ORDER BY ${ACCOUNT_ORDER[options.sort]}`,
			)
			.all(ctx.entityId),
	)
}
