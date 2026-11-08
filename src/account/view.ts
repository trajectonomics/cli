import type { AccountType } from "@trajectonomics/ledger"
import { z } from "zod"
import type { AccountRow } from "../store"

export const ACCOUNT_TYPE_VALUES: readonly [AccountType, ...AccountType[]] = [
	"asset",
	"liability",
	"equity",
	"income",
	"expense",
]

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
