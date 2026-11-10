import type { RestoreRows } from "../store"
import { must, mustOpen, tempHome } from "../store/testing"
import { FIXTURE_ROWS } from "./data"
import { FIXTURE_ACCOUNTS, posting, transaction } from "./rows"

export { FIXTURE_ROWS } from "./data"
export { FIXTURE_ACCOUNTS, FIXTURE_AS_OF } from "./rows"

const MAX = Number.MAX_SAFE_INTEGER

/**
 * The fixture plus two Transactions that push Food and Salary past the safe integer range, so a
 * report's `AMOUNT_OVERFLOW` path can be exercised. Food's id sorts first, so it is the leaf the
 * core rejects first.
 */
export function overflowRows(): RestoreRows {
	const ids = ["0194b000-0009-7000-8000-000000000009", "0194b000-0010-7000-8000-000000000010"]
	return {
		...FIXTURE_ROWS,
		tx: [...FIXTURE_ROWS.tx, ...ids.map((id, index) => transaction(id, `2026-01-0${index + 2}`))],
		posting: [
			...FIXTURE_ROWS.posting,
			...ids.flatMap((id) => [
				posting(id, 0, FIXTURE_ACCOUNTS.food, MAX),
				posting(id, 1, FIXTURE_ACCOUNTS.salary, -MAX),
			]),
		],
	}
}

/** A fresh data directory holding `rows`, written through `Store.restore` and read-only after. */
export function seededHome(rows: RestoreRows): string {
	const home = tempHome()
	const store = mustOpen(home)
	must(store.restore(rows))
	store.close()
	return home
}

/** A fresh data directory holding the shared fixture Ledger. */
export function fixtureHome(): string {
	return seededHome(FIXTURE_ROWS)
}
