import type { AccountType } from "@trajectonomics/ledger"
import { z } from "zod"
import type { Context, Result } from "../../command"
import { type AppError, fail, isAppError } from "../../errors"
import { type AccountRow, openStore, type Store } from "../../store"

export const ACCOUNT_TYPE_VALUES: readonly [AccountType, ...AccountType[]] = [
	"asset",
	"liability",
	"equity",
	"income",
	"expense",
]

// A canonical UUID shape in any case: ids are read before names (ADR-0018), so a name that looks
// like one would make an account unreachable by the word the user typed.
export const UUID_SHAPED: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type AccountView = {
	id: string
	name: string
	type: AccountType
	currency: string
	parentId: string | null
	archivedAt: string | null
	version: number
	createdAt: string
	updatedAt: string
}

export type WrittenAccount = Omit<AccountView, "id"> & { id: string | null }
export type AccountRef = { id: string; name: string }

const accountShape = {
	id: z.string().describe("The account's UUIDv7 id."),
	name: z.string().describe("The account's exact, case-sensitive name."),
	type: z.enum(ACCOUNT_TYPE_VALUES).describe("asset, liability, equity, income or expense."),
	currency: z.string().describe("The account's ISO 4217 currency; v1 is THB only."),
	parentId: z.string().nullable().describe("The parent account's id, or null at the top level."),
	archivedAt: z.string().nullable().describe("When the account was archived, or null."),
	version: z.number().int().describe("The row's version."),
	createdAt: z.string().describe("When the row was created."),
	updatedAt: z.string().describe("When the row was last changed."),
}

const refShape = {
	id: z.string().describe("The account's id."),
	name: z.string().describe("The account's name."),
}

export const accountRow: z.ZodType<AccountView> = z.strictObject(accountShape)
export const writtenAccount: z.ZodType<WrittenAccount> = z.strictObject({
	...accountShape,
	id: z.string().nullable().describe("The account's id; null under --dry-run."),
})
export const accountRef: z.ZodType<AccountRef> = z.strictObject(refShape)

export function view(row: AccountRow): AccountView {
	return {
		id: row.id,
		name: row.name,
		type: row.type,
		currency: row.currency,
		parentId: row.parentId,
		archivedAt: row.archivedAt,
		version: row.version,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	}
}

export function ref(row: AccountRow): AccountRef {
	return { id: row.id, name: row.name }
}

export function notFound(account: string): AppError {
	return fail("not_found", {
		message: `No account matches "${account}".`,
		details: { resource: "account" },
		hint: 'Run "traj account list" to see the chart.',
	})
}

/** Opens the store for one command and closes it again, even when the command throws. */
export function withStore<T>(
	ctx: Context,
	work: (store: Store) => Result<T> | AppError,
): Result<T> | AppError {
	const store = openStore({ env: ctx.env, clock: () => new Date() })
	if (isAppError(store)) return store
	try {
		return work(store)
	} finally {
		store.close()
	}
}
