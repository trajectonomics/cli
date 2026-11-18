import type { Context, Result } from "./command"
import { type AppError, isAppError } from "./errors"
import { openStore, type Store } from "./store"
import { databaseFailure } from "./store/io-errors"

/** Opens the store for one command and closes it again, even when the command throws. */
export function withStore<T>(
	ctx: Context,
	work: (store: Store) => Result<T> | AppError,
): Result<T> | AppError {
	const store = openStore({ env: ctx.env, clock: () => new Date() })
	if (isAppError(store)) return store
	try {
		try {
			return work(store)
		} catch (error) {
			// A write refused by the filesystem (a read-only file, a full disk) is the store's
			// failure, not a bug: name the database path instead of reporting `internal`.
			const failure = databaseFailure(store.path, error)
			if (failure !== undefined) return failure
			throw error
		}
	} finally {
		store.close()
	}
}
