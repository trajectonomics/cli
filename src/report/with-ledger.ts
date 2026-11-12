import type { Context, Result } from "../command"
import { ok } from "../command"
import type { AppError } from "../errors"
import { isAppError } from "../errors"
import type { Ledger } from "../store"
import { withStore } from "../with-store"

/** Opens the store, assembles one read of the Ledger, and renders the work's result or failure. */
export function withLedger<T>(
	ctx: Context,
	work: (ledger: Ledger) => T | AppError,
): Result<T> | AppError {
	return withStore(ctx, (store) => {
		const ledger = store.ledger()
		if (isAppError(ledger)) return ledger
		const result = work(ledger)
		return isAppError(result) ? result : ok(result)
	})
}
