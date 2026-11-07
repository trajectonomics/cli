import { Database } from "bun:sqlite"
import { expect } from "bun:test"
import { type AppError, isAppError } from "../errors"
import type { Clock, Store } from "../store"
import { mustOpen, steppingClock, tempHome } from "../store/testing"
import { importJsonl } from "./read"

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

const TABLES = {
	entity: "id",
	account: "id",
	tx: "id",
	posting: "tx_id, ordinal",
	scenario: "id",
} as const

/** Every table's `SELECT *`, read through a separate connection, keyed by table. */
export function tableDump(store: Store): Record<string, unknown[]> {
	const db = new Database(store.path, { readonly: true })
	const dump = Object.fromEntries(
		Object.entries(TABLES).map(([table, key]) => [
			table,
			db.query(`SELECT * FROM ${table} ORDER BY ${key}`).all(),
		]),
	)
	db.close()
	return dump
}

/** Imports into a fresh store and asserts the refusal left every table as it was. */
export function refused(text: string, store: Store = mustOpen(tempHome())): AppError["body"] {
	const before = tableDump(store)
	const outcome = importJsonl(text, store)
	if (!isAppError(outcome)) throw new Error("the import was accepted")
	expect(tableDump(store)).toEqual(before)
	return outcome.body
}

/** `text` with the first `from` replaced by `to`; fails when the fixture lacks `from`. */
export function edit(text: string, from: string, to: string): string {
	if (!text.includes(from)) throw new Error(`the fixture does not contain ${from}`)
	return text.replace(from, to)
}
