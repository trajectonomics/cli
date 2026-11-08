import type { Context, Result } from "../command"
import { type AppError, isAppError } from "../errors"
import { openStore, type Store } from "../store"

/** Opens the store for one command and closes it again, even when the command throws. */
export function withStore<T>(
	ctx: Context,
	work: (store: Store) => Result<T> | AppError,
): Result<T> | AppError {
	const store = openStore({ env: ctx.env, clock: () => new Date() })
	if (isAppError(store)) return store
	try {
		return work(store)
	} finally {
		store.close()
	}
}
