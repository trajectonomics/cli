import type { AppError } from "../errors"
import { fail } from "../errors"

export function notFound(account: string): AppError {
	return fail("not_found", {
		message: `No account matches "${account}".`,
		details: { resource: "account" },
		hint: 'Run "traj account list" to see the chart.',
	})
}
