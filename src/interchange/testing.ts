import { Database } from "bun:sqlite"
import type { Clock, Store } from "../store"
import { mustOpen, steppingClock, tempHome } from "../store/testing"

const FIXTURES = new URL("./fixtures/", import.meta.url)

/** The committed golden export, written by hand from `fixtures/golden.sql`. */
export function goldenJsonl(): Promise<string> {
	return Bun.file(new URL("golden.jsonl", FIXTURES)).text()
}

/**
 * A fresh store holding the golden fixture database. The rows are literal SQL, so the database
 * is the same on every run and owes nothing to the reader under test.
 */
export async function goldenStore(clock: Clock = steppingClock()): Promise<Store> {
	const store = mustOpen(tempHome(), clock)
	const db = new Database(store.path)
	db.run(await Bun.file(new URL("golden.sql", FIXTURES)).text())
	db.close()
	return store
}
