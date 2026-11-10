import type { AccountType, ChartOfAccounts } from "@trajectonomics/ledger"
import type { AppError } from "../errors"
import type { ScenarioDocument } from "../scenario/envelope"
import type { AccountRow, EntityRow, PostingRow, ScenarioRow, TxRow } from "./rows"
import type { TxFilter } from "./tx-filter"
import type { NewAmendment, NewTransaction, TxAdded, TxAmended, TxVoided } from "./tx-types"

export type {
	AccountRow,
	EntityRow,
	PostingRow,
	ScenarioRow,
	TxCorrection,
	TxRow,
} from "./rows"
export type { TxFilter } from "./tx-filter"
export type {
	ImportRejection,
	NewAmendment,
	NewPosting,
	NewTransaction,
	TxAdded,
	TxAmended,
	TxStatus,
	TxVoided,
	TxWritten,
} from "./tx-types"

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

/** Runs the write for real, then rolls it back before commit (ADR-0019). */
export type WriteOptions = { dryRun?: boolean }

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

export type NewScenario = { name: string; document: unknown }
export type ScenarioSaved = { status: "created" | "updated" | "unchanged"; scenario: ScenarioRow }
export type ScenarioForked =
	| { status: "forked" | "name_taken"; scenario: ScenarioRow }
	| { status: "not_found" }
export type ScenarioDeleted = { status: "deleted"; scenario: ScenarioRow } | { status: "not_found" }

/**
 * A pure change to a fork's copy, applied inside the fork's one write. Return an `AppError`
 * (usually `invalid_input`) and the whole write rolls back.
 */
export type ScenarioTransform = (document: ScenarioDocument) => ScenarioDocument | AppError

export type ForkOptions = WriteOptions & { transform?: ScenarioTransform }

/** Every row of a lossless dump, by table, exactly as the list methods return them. */
export type RestoreRows = {
	entity: readonly EntityRow[]
	account: readonly AccountRow[]
	tx: readonly TxRow[]
	posting: readonly PostingRow[]
	scenario: readonly ScenarioRow[]
}
export type RestoreCounts = { [Table in keyof RestoreRows]: number }

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
	createAccount(input: NewAccount, options?: WriteOptions): AccountCreated | AppError
	listAccounts(options: ListOptions<AccountSort>): AccountRow[] | AppError
	/** The non-tombstoned account this id or exact name names; an id is read first (ADR-0018). */
	getAccount(idOrName: string): AccountRow | null | AppError
	/** Direct children of one account, by name; archived children stay, tombstones never appear. */
	listChildAccounts(parentId: string): AccountRow[] | AppError
	closeAccount(id: string, options?: WriteOptions): AccountClosed | AppError
	deleteAccount(id: string): AccountDeleted | AppError
	/** The entity's full chart, archived accounts included; the core builds and validates against it. */
	chart(): ChartOfAccounts | AppError
	addTransaction(input: NewTransaction, options?: WriteOptions): TxAdded | AppError
	/**
	 * Writes every built row in one transaction, in input order; the batch reads the clock once.
	 * Any rejection rolls the whole batch back and lists `{ index, reason }` for each rejected row.
	 */
	importTransactions(
		inputs: readonly NewTransaction[],
		options?: WriteOptions,
	): readonly TxAdded[] | AppError
	voidTransaction(id: string, input: { date: string }, options?: WriteOptions): TxVoided | AppError
	/** Writes the reversal and the replacement in one transaction, both linked to the original. */
	amendTransaction(id: string, input: NewAmendment, options?: WriteOptions): TxAmended | AppError
	listTransactions(options: { sort: TxSort } & TxFilter): TxRow[] | AppError
	/** The transaction with this id in the personal entity, or null. */
	getTransaction(id: string): TxRow | null | AppError
	listPostings(options: { sort: PostingSort; filter?: TxFilter }): PostingRow[] | AppError
	saveScenario(input: NewScenario, options?: WriteOptions): ScenarioSaved | AppError
	/** Copies a live Scenario by id; `transform` runs inside the same write (ADR-0019, ADR-0024). */
	forkScenario(id: string, name: string, options?: ForkOptions): ScenarioForked | AppError
	deleteScenario(id: string, options?: WriteOptions): ScenarioDeleted | AppError
	/** The live Scenario this id or exact name names; an id is read first (ADR-0018). */
	getScenario(idOrName: string): ScenarioRow | null | AppError
	listScenarios(options: ListOptions<ScenarioSort>): ScenarioRow[] | AppError
	/**
	 * Every row of every table, tombstones included, in the export's canonical order, read inside
	 * one deferred read transaction so one dump never mixes two snapshots.
	 */
	dump(): RestoreRows | AppError
	/** Each table's tombstone-inclusive row count, equal to the dump's own counts. */
	counts(): RestoreCounts | AppError
	/**
	 * Writes `rows` verbatim (ids, versions, timestamps, tombstones) into a database holding only
	 * the seeded personal entity, in one transaction that reads no clock. References may point
	 * forward; any left dangling roll the whole restore back.
	 */
	restore(rows: RestoreRows): RestoreCounts | AppError
	close(): void
}
