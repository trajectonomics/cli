import { type AppError, fail } from "../errors"
import { liveAccount } from "./accounts"
import type { Ctx } from "./context"
import { txById } from "./tx-content"
import type { NewTransaction } from "./types"

function postingAccount(ctx: Ctx, accountId: string, index: number): AppError | undefined {
	const path = `postings.${index}.accountId`
	const account = liveAccount(ctx, accountId)
	if (!account) {
		const reason = "is not a live account of this entity"
		const details = { field: path, value: accountId, reason }
		return fail("UNKNOWN_ACCOUNT", { path, message: `${path}: ${reason}`, details })
	}
	if (account.archivedAt === null) return undefined
	return fail("account_archived", {
		path,
		message: `Account ${account.name} is archived and accepts no postings.`,
		details: { accountId, archivedAt: account.archivedAt },
	})
}

/**
 * The store's own rules, checked before the core sees the transaction: every posting names a
 * live, unarchived account of this entity, and a link points at an existing transaction.
 */
export function storeChecks(ctx: Ctx, input: NewTransaction): AppError | undefined {
	for (const [index, posting] of input.postings.entries()) {
		const failure = postingAccount(ctx, posting.accountId, index)
		if (failure) return failure
	}
	if (input.linkedTo === undefined || txById(ctx, input.linkedTo)) return undefined
	return fail("invalid_input", {
		path: "linkedTo",
		message: `linkedTo: no transaction ${input.linkedTo} in this entity`,
	})
}
