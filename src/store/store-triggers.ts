// Test support for contract.test.ts: one real store path per code the store raises itself.
import { Database } from "bun:sqlite"
import { join } from "node:path"
import type { ErrorCode } from "../errors"
import { capture } from "../test-support"
import { coreOnly } from "./core-triggers"
import { openStore } from "./index"
import { HEAD } from "./migrations"
import { must, mustOpen, steppingClock, tempHome } from "./testing"
import type { NewPosting, NewTransaction } from "./types"

/** A trigger returns what the store returned; the contract test asserts it is an AppError. */
export type Trigger = () => unknown | Promise<unknown>

/** Every code that is not one of the CLI's own; adding a code fails typecheck until it has one. */
export type StoreRaised = Exclude<
	ErrorCode,
	"internal" | "invalid_input" | "unknown_command" | "unknown_flag" | "unknown_format"
>

function fixture() {
	const store = mustOpen(tempHome())
	const open = (name: string, type: "asset" | "expense", parentId?: string) =>
		must(store.createAccount({ name, type, currency: "THB", ...(parentId ? { parentId } : {}) }))
			.account.id
	const [cash, food, bank] = [open("Cash", "asset"), open("Food", "expense"), open("Bank", "asset")]
	open("Savings", "asset", bank)
	const postingTo = (accountId: string, amount: number, extra?: Partial<NewPosting>) =>
		Object.assign({ accountId, amount, currency: "THB" }, extra)
	const add = (postings: NewPosting[], extra: Partial<NewTransaction> = {}) =>
		store.addTransaction({ date: "2026-03-01", postings, ...extra })
	return { store, cash, food, bank, postingTo, add }
}

const posting =
	(make: (f: ReturnType<typeof fixture>) => unknown): Trigger =>
	() =>
		make(fixture())

function openAt(prepare: (db: Database) => void): Trigger {
	return async () => {
		const home = tempHome()
		await capture(["init"], { TRAJ_HOME: home })
		const db = new Database(join(home, "traj.db"))
		prepare(db)
		db.close()
		return openStore({ env: { TRAJ_HOME: home }, clock: steppingClock() })
	}
}

function busy(): unknown {
	const home = tempHome()
	mustOpen(home).close()
	const holder = new Database(join(home, "traj.db"))
	holder.run("BEGIN IMMEDIATE")
	const store = openStore({ env: { TRAJ_HOME: home }, clock: steppingClock(), busyTimeoutMs: 1 })
	const outcome =
		"path" in store ? store.createAccount({ name: "X", type: "asset", currency: "THB" }) : store
	holder.run("ROLLBACK")
	holder.close()
	return outcome
}

/** Every code the store produces, each reached through the store itself. */
export const storeTriggers: Record<StoreRaised, Trigger> = {
	account_archived: posting(({ store, add, postingTo, cash, food }) => {
		must(store.closeAccount(food))
		return add([postingTo(food, 1), postingTo(cash, -1)])
	}),
	external_ref_conflict: posting(({ add, postingTo, cash, food }) => {
		must(add([postingTo(food, 1), postingTo(cash, -1)], { externalRef: "r" }))
		return add([postingTo(food, 2), postingTo(cash, -2)], { externalRef: "r" })
	}),
	database_busy: busy,
	database_too_new: openAt((db) => db.run(`PRAGMA user_version = ${HEAD + 1}`)),
	// A file someone else already put an `account` table in cannot take step 1.
	migration_failed: openAt((db) => db.run("CREATE TABLE account (x)")),
	SINGLE_POSTING: posting(({ add, postingTo, cash }) => add([postingTo(cash, 1)])),
	INVALID_AMOUNT: posting(({ add, postingTo, cash, food }) =>
		add([postingTo(food, 0.5), postingTo(cash, -0.5)]),
	),
	ZERO_AMOUNT_POSTING: posting(({ add, postingTo, cash, food }) =>
		add([postingTo(food, 0), postingTo(cash, 0)]),
	),
	UNKNOWN_ACCOUNT: posting(({ add, postingTo, cash }) =>
		add([postingTo("nope", 1), postingTo(cash, -1)]),
	),
	NON_LEAF_ACCOUNT: posting(({ add, postingTo, bank, food }) =>
		add([postingTo(food, 1), postingTo(bank, -1)]),
	),
	CURRENCY_MISMATCH: posting(({ add, postingTo, cash, food }) =>
		add([postingTo(food, 1, { currency: "USD" }), postingTo(cash, -1, { currency: "USD" })]),
	),
	UNBALANCED_TRANSACTION: posting(({ add, postingTo, cash, food }) =>
		add([postingTo(food, 2), postingTo(cash, -1)]),
	),
	INVALID_DATE: posting(({ add, postingTo, cash, food }) =>
		add([postingTo(food, 1), postingTo(cash, -1)], { date: "2026-02-30" }),
	),
	INVALID_CURRENCY: posting(({ store }) =>
		store.createAccount({ name: "Y", type: "asset", currency: "ZZZ" }),
	),
	INVALID_DIMENSION: posting(({ add, postingTo, cash, food }) =>
		add([postingTo(food, 1, { dimensions: { project: "" } }), postingTo(cash, -1)]),
	),
	INVALID_ACCOUNT_HIERARCHY: posting(({ store }) =>
		store.createAccount({ name: "Z", type: "asset", currency: "THB", parentId: "nope" }),
	),
	...coreOnly(),
}
