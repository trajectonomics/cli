import type { RestoreRows } from "../store"
import { must, mustOpen, tempHome } from "../store/testing"
import { FIXTURE_ROWS } from "./data"

export { FIXTURE_ROWS } from "./data"
export { FIXTURE_ACCOUNTS, FIXTURE_AS_OF } from "./rows"

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
