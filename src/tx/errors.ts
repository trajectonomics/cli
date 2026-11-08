import { type AppError, fail } from "../errors"

/**
 * A posting names an account outside the chart. It is the core's `UNKNOWN_ACCOUNT` at exit 3,
 * never `not_found`: the transaction is the command's target, the account is one of its postings.
 */
export function unknownAccount(ref: string, path: string): AppError {
	const reason = "is not in the chart of accounts"
	return fail("UNKNOWN_ACCOUNT", {
		path,
		message: `${path}: no account matches "${ref}"`,
		details: { field: path, value: ref, reason },
	})
}
