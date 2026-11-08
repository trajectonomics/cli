import { z } from "zod"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { type AppError, fail, isAppError } from "../../errors"
import type { AccountRow, Store } from "../../store"
import {
	ACCOUNT_TYPE_VALUES,
	notFound,
	UUID_SHAPED,
	view,
	withStore,
	writtenAccount,
} from "./shared"

const accountType = z.enum(ACCOUNT_TYPE_VALUES)

type ParentId = { parentId?: string }

function parentOf(store: Store, parent: string | undefined): ParentId | AppError {
	if (parent === undefined) return {}
	const row = store.getAccount(parent)
	if (isAppError(row)) return row
	return row === null ? notFound(parent) : { parentId: row.id }
}

function invalidName(): AppError {
	return fail("invalid_input", {
		path: "name",
		message: "name: an account name cannot be shaped like a UUID",
	})
}

function taken(account: AccountRow): AppError {
	return fail("account_name_taken", {
		path: "name",
		message: `An account named "${account.name}" already exists.`,
		details: { accountId: account.id },
	})
}

export const add: Leaf = defineCommand({
	name: "add",
	summary: "Create an account in the chart",
	positionals: ["name"],
	input: z.strictObject({
		name: z
			.string()
			.min(1)
			.describe("The account's name; exact, case-sensitive and not shaped like a UUID."),
		type: accountType.describe("The kind of account."),
		currency: z.string().describe("ISO 4217 currency; v1 supports THB only."),
		parent: z.string().optional().describe("The parent account's name or id."),
		dryRun: z.boolean().optional().describe("Report the row and roll the write back."),
	}),
	output: z.strictObject({
		dryRun: z.boolean().describe("True when the write was rolled back."),
		account: writtenAccount,
	}),
	examples: [
		{
			command: "traj account add Cash --type asset --currency THB",
			description: "Create a top-level cash account.",
		},
		{
			command: "traj account add Savings --type asset --currency THB --parent Bank",
			description: "Nest it under a parent account.",
		},
	],
	errorCodes: [
		"INVALID_ACCOUNT_HIERARCHY",
		"INVALID_CURRENCY",
		"account_name_taken",
		"invalid_input",
		"not_found",
		"unsupported_currency",
	],
	run: (input, ctx) => {
		if (UUID_SHAPED.test(input.name)) return invalidName()
		return withStore(ctx, (store) => {
			const parent = parentOf(store, input.parent)
			if (isAppError(parent)) return parent
			const dryRun = input.dryRun === true
			const outcome = store.createAccount(
				{ name: input.name, type: input.type, currency: input.currency, ...parent },
				{ dryRun },
			)
			if (isAppError(outcome)) return outcome
			if (outcome.status === "name_taken") return taken(outcome.account)
			const account = view(outcome.account)
			return ok({ dryRun, account: { ...account, id: dryRun ? null : account.id } })
		})
	},
})
