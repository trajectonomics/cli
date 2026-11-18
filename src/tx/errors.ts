import { type AppError, fail } from "../errors"
import { UNKNOWN_ACCOUNT_HINT } from "../hint"

/**
 * A posting names an account outside the chart. It is the core's `UNKNOWN_ACCOUNT` at exit 3,
 * never `not_found`: the transaction is the command's target, the account is one of its postings.
 */
export function unknownAccount(ref: string, path: string): AppError {
	const reason = "is not in the chart of accounts"
	return fail("UNKNOWN_ACCOUNT", {
		path,
		message: `${path}: no account matches "${ref}"`,
		hint: UNKNOWN_ACCOUNT_HINT,
		details: { field: path, value: ref, reason },
	})
}

/** `tx show` found no transaction with this id: a lookup miss at exit 4 (ADR-0021). */
export function transactionNotFound(id: string): AppError {
	return fail("not_found", {
		message: `No transaction matches "${id}".`,
		details: { resource: "transaction" },
		hint: 'Run "traj tx list" to see the ledger.',
	})
}
