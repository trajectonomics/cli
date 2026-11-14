// Test support for contract.test.ts: one real store path per code the store raises itself.
import type { ErrorCode } from "../errors"
import { coreOnly } from "./core-triggers"
import { HEAD } from "./migrations"
import { must, mustOpen, tempHome } from "./testing"
import { busy, openAt, type Trigger } from "./trigger-setup"
import type { NewPosting, NewTransaction } from "./types"

export type { Trigger } from "./trigger-setup"

/** Every code the store raises itself; adding one fails typecheck until it has a trigger. */
export type StoreRaised = Exclude<
	ErrorCode,
	| "internal"
	| "invalid_input"
	| "unknown_command"
	| "unknown_flag"
	| "unknown_format"
	// Commands map these from a store status; the store itself never raises them (ADR-0021).
	| "account_name_taken"
	| "scenario_name_taken"
	| "not_found"
	// Raised by the export command, which is the only writer outside the data directory.
	| "output_exists"
	| "export_failed"
	// Raised by the projection commands, from the engine's own problems.
	| "projection_refused"
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

const accountIn = (currency: string): Trigger =>
	posting(({ store }) => store.createAccount({ name: currency, type: "asset", currency }))

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
	INVALID_CURRENCY: accountIn("ZZZ"),
	unsupported_currency: accountIn("USD"),
	INVALID_DIMENSION: posting(({ add, postingTo, cash, food }) =>
		add([postingTo(food, 1, { dimensions: { project: "" } }), postingTo(cash, -1)]),
	),
	INVALID_ACCOUNT_HIERARCHY: posting(({ store }) =>
		store.createAccount({ name: "Z", type: "asset", currency: "THB", parentId: "nope" }),
	),
	...coreOnly(),
}
