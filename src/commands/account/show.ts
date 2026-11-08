import { z } from "zod"
import { notFound } from "../../account/errors"
import { type AccountRef, accountRef, accountRow, ref, view } from "../../account/view"
import type { Leaf } from "../../command"
import { defineCommand, ok } from "../../command"
import { type AppError, isAppError } from "../../errors"
import type { AccountRow, Store } from "../../store"
import { withStore } from "../../with-store"

type Relations = { parent: AccountRef | null; children: AccountRef[] }

function relationsOf(store: Store, account: AccountRow): Relations | AppError {
	const parent = account.parentId === null ? null : store.getAccount(account.parentId)
	if (isAppError(parent)) return parent
	const children = store.listChildAccounts(account.id)
	if (isAppError(children)) return children
	return {
		parent: parent === null ? null : ref(parent),
		children: children.map(ref),
	}
}

export const show: Leaf = defineCommand({
	name: "show",
	summary: "Show one account with its parent and children",
	positionals: ["account"],
	input: z.strictObject({
		account: z.string().describe("The account's exact name or its id."),
	}),
	output: z.strictObject({
		account: accountRow,
		parent: accountRef.nullable().describe("The parent, one level up, or null."),
		children: z.array(accountRef).describe("Direct children by name, one level down."),
	}),
	examples: [
		{ command: "traj account show Cash", description: "Show an account by name." },
		{ command: "traj account show 0194a000-0002-7000-8000-000000000002", description: "By id." },
	],
	errorCodes: ["not_found"],
	run: (input, ctx) =>
		withStore(ctx, (store) => {
			const account = store.getAccount(input.account)
			if (isAppError(account)) return account
			if (account === null) return notFound(input.account)
			const relations = relationsOf(store, account)
			return isAppError(relations) ? relations : ok({ account: view(account), ...relations })
		}),
})
