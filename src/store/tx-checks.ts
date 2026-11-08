import { type AppError, fail } from "../errors"
import { liveAccount } from "./accounts"
import type { Ctx } from "./context"
import { txByExternalRef, txById } from "./tx-content"
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
 * The store's own rules, checked before the core sees the transaction: a linked row names what it
 * is, every posting names a live, unarchived account of this entity, and a link points at an
 * existing transaction.
 */
export function storeChecks(ctx: Ctx, input: NewTransaction): AppError | undefined {
	if ((input.linkedTo === undefined) !== (input.correctionKind === undefined)) {
		return fail("invalid_input", {
			path: "correctionKind",
			message: "correctionKind: must be set exactly when linkedTo is",
		})
	}
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

/** A reference another row already holds; an amend's replacement may not reuse one. */
export function externalRefTaken(ctx: Ctx, externalRef: string | undefined): AppError | undefined {
	if (externalRef === undefined) return undefined
	const stored = txByExternalRef(ctx, externalRef)
	if (stored === null) return undefined
	return fail("external_ref_conflict", {
		path: "externalRef",
		details: { externalRef, txId: stored.id },
	})
}
