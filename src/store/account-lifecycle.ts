import type { AppError } from "../errors"
import { liveAccount } from "./accounts"
import type { Ctx } from "./context"
import { write } from "./guard"
import { iso } from "./ids"
import type { AccountClosed, AccountDeleted, WriteOptions } from "./types"

/** Archives: the account stops taking postings and stays in history, reports and exports. */
export function closeAccount(
	ctx: Ctx,
	id: string,
	options: WriteOptions = {},
): AccountClosed | AppError {
	return write(
		ctx.db,
		() => {
			const account = liveAccount(ctx, id)
			if (!account) return { status: "not_found" }
			if (account.archivedAt !== null) return { status: "already_archived", account }
			ctx.db.run(
				`UPDATE account SET archived_at = ?2, version = version + 1, updated_at = ?2
				WHERE id = ?1`,
				[id, iso(ctx.clock())],
			)
			return { status: "archived", account: liveAccount(ctx, id)! }
		},
		options,
	)
}

function blocker(ctx: Ctx, id: string): "has_postings" | "has_children" | null {
	const used = ctx.db.query("SELECT 1 FROM posting WHERE account_id = ?1 LIMIT 1").get(id)
	if (used) return "has_postings"
	const parent = ctx.db
		.query("SELECT 1 FROM account WHERE parent_id = ?1 AND deleted_at IS NULL LIMIT 1")
		.get(id)
	return parent ? "has_children" : null
}

/**
 * Tombstones an account that never carried ledger meaning (ADR-0016). One with postings, or
 * with live children whose hierarchy would break, is refused by status rather than by a code.
 */
export function deleteAccount(ctx: Ctx, id: string): AccountDeleted | AppError {
	return write(ctx.db, () => {
		const account = liveAccount(ctx, id)
		if (!account) return { status: "not_found" }
		const reason = blocker(ctx, id)
		if (reason) return { status: reason, account }
		const at = iso(ctx.clock())
		ctx.db.run(
			"UPDATE account SET deleted_at = ?2, version = version + 1, updated_at = ?2 WHERE id = ?1",
			[id, at],
		)
		return {
			status: "deleted",
			account: { ...account, deletedAt: at, updatedAt: at, version: account.version + 1 },
		}
	})
}
