import type { AccountType } from "@trajectonomics/ledger"
import type { AppError } from "../errors"
import type { AccountRow, EntityRow, PostingRow, ScenarioRow, TxRow } from "./rows"

export type { AccountRow, EntityRow, PostingRow, ScenarioRow, TxRow } from "./rows"

/** The only source of time the store reads. Nothing in the store calls `Date.now()`. */
export type Clock = () => Date

/** Every list names its order; each order ends on a unique key, so it is total. */
export type EntitySort = "id"
export type AccountSort = "id" | "name" | "created_at"
export type TxSort = "id" | "date" | "created_at"
export type PostingSort = "tx_id"
export type ScenarioSort = "id" | "name" | "created_at"

export type ListOptions<S> = {
	sort: S
	/** Include tombstoned rows (the export needs them). Defaults to false. */
	includeDeleted?: boolean
}

export type NewAccount = { name: string; type: AccountType; currency: string; parentId?: string }
export type AccountCreated =
	| { status: "created"; account: AccountRow }
	| { status: "name_taken"; account: AccountRow }
export type AccountClosed =
	| { status: "archived" | "already_archived"; account: AccountRow }
	| { status: "not_found" }
export type AccountDeleted =
	| { status: "deleted" | "has_postings" | "has_children"; account: AccountRow }
	| { status: "not_found" }

export type NewPosting = {
	accountId: string
	/** Signed integer minor units: debit `+`, credit `-`. */
	amount: number
	currency: string
	dimensions?: Readonly<Record<string, string>>
}
export type NewTransaction = {
	date: string
	postings: readonly NewPosting[]
	memo?: string
	linkedTo?: string
	externalRef?: string
}
export type TxAdded = { status: "added" | "duplicate"; tx: TxRow; postings: PostingRow[] }

export type NewScenario = { name: string; document: unknown }
export type ScenarioSaved = { status: "created" | "updated" | "unchanged"; scenario: ScenarioRow }
export type ScenarioForked =
	| { status: "forked" | "name_taken"; scenario: ScenarioRow }
	| { status: "not_found" }
export type ScenarioDeleted = { status: "deleted"; scenario: ScenarioRow } | { status: "not_found" }

/**
 * The only code that reads or writes `traj.db`. Every method returns its value or an `AppError`
 * built by `fail()`; none throws for an expected failure.
 */
export interface Store {
	/** The database file this store owns. */
	readonly path: string
	/** The personal entity every account, transaction and scenario belongs to. */
	readonly entityId: string
	/** `PRAGMA user_version`: the schema version the export header carries. */
	schemaVersion(): number | AppError
	listEntities(options: ListOptions<EntitySort>): EntityRow[] | AppError
	createAccount(input: NewAccount): AccountCreated | AppError
	listAccounts(options: ListOptions<AccountSort>): AccountRow[] | AppError
	closeAccount(id: string): AccountClosed | AppError
	deleteAccount(id: string): AccountDeleted | AppError
	addTransaction(input: NewTransaction): TxAdded | AppError
	listTransactions(options: { sort: TxSort }): TxRow[] | AppError
	listPostings(options: { sort: PostingSort }): PostingRow[] | AppError
	saveScenario(input: NewScenario): ScenarioSaved | AppError
	forkScenario(id: string, name: string): ScenarioForked | AppError
	deleteScenario(id: string): ScenarioDeleted | AppError
	listScenarios(options: ListOptions<ScenarioSort>): ScenarioRow[] | AppError
	close(): void
}
