/** The coarse class of a finished run. Closed: nothing outside this union can be constructed. */
export type ExitCode = 0 | 1 | 2 | 3 | 4 | 5

/**
 * Every registered failure name, never reused. CLI-owned codes are snake_case; the ledger core's
 * codes are registered verbatim in upper case, so a caller sees the core's own name for a rule.
 */
export type ErrorCode =
	| "internal"
	| "invalid_input"
	| "unknown_command"
	| "unknown_flag"
	| "unknown_format"
	| "not_found"
	| "account_name_taken"
	| "scenario_name_taken"
	| "unsupported_currency"
	| "account_archived"
	| "external_ref_conflict"
	| "database_busy"
	| "database_too_new"
	| "migration_failed"
	| "SINGLE_POSTING"
	| "INVALID_AMOUNT"
	| "ZERO_AMOUNT_POSTING"
	| "UNKNOWN_ACCOUNT"
	| "NON_LEAF_ACCOUNT"
	| "CURRENCY_MISMATCH"
	| "UNBALANCED_TRANSACTION"
	| "INVALID_DATE"
	| "INVALID_CURRENCY"
	| "INVALID_DIMENSION"
	| "INVALID_ACCOUNT_HIERARCHY"
	| "NEGATIVE_AMOUNT"
	| "DUPLICATE_TRANSACTION_ID"
	| "REVERSAL_BEFORE_ORIGINAL"
	| "NON_EQUITY_CONTRA"
	| "INVALID_PERIOD"
	| "AMOUNT_OVERFLOW"

export type ErrorSpec = { exit: ExitCode; message: string }

/**
 * The single source of truth for failures. The envelope's `exitCode`, `run()`'s return value,
 * `traj schema` and the tests all read this table. A code carries exactly one class; a case that
 * seems to need two classes is two codes.
 */
export const registry: Record<ErrorCode, ErrorSpec> = {
	internal: { exit: 1, message: "Unexpected internal error." },
	invalid_input: { exit: 2, message: "The input is invalid." },
	unknown_command: { exit: 2, message: "Unknown command." },
	unknown_flag: { exit: 2, message: "Unknown flag." },
	unknown_format: { exit: 2, message: "Unknown output format." },
	not_found: { exit: 4, message: "The requested resource was not found." },
	account_name_taken: { exit: 5, message: "An account with this name already exists." },
	scenario_name_taken: { exit: 5, message: "A scenario with this name already exists." },
	unsupported_currency: { exit: 3, message: "The currency is not supported in v1." },
	account_archived: { exit: 3, message: "The account is archived and accepts no postings." },
	external_ref_conflict: {
		exit: 5,
		message: "A transaction with this external reference already exists with other content.",
	},
	database_busy: { exit: 5, message: "The database is busy; another writer holds it." },
	database_too_new: { exit: 5, message: "The database was written by a newer traj." },
	migration_failed: { exit: 1, message: "The database could not be migrated." },
	SINGLE_POSTING: { exit: 3, message: "A transaction needs at least two postings." },
	INVALID_AMOUNT: { exit: 3, message: "The amount is not a safe integer of minor units." },
	ZERO_AMOUNT_POSTING: { exit: 3, message: "A posting amount cannot be zero." },
	UNKNOWN_ACCOUNT: { exit: 3, message: "The account does not exist." },
	NON_LEAF_ACCOUNT: { exit: 3, message: "Only a leaf account can take postings." },
	CURRENCY_MISMATCH: { exit: 3, message: "The currency does not match the account's." },
	UNBALANCED_TRANSACTION: { exit: 3, message: "The postings do not sum to zero." },
	INVALID_DATE: { exit: 3, message: "The date is not a real YYYY-MM-DD calendar date." },
	INVALID_CURRENCY: { exit: 3, message: "The currency is not an ISO 4217 code." },
	INVALID_DIMENSION: { exit: 3, message: "A dimension key or value is empty." },
	INVALID_ACCOUNT_HIERARCHY: { exit: 3, message: "The account hierarchy is invalid." },
	NEGATIVE_AMOUNT: { exit: 3, message: "The amount must not be negative." },
	DUPLICATE_TRANSACTION_ID: { exit: 3, message: "The transaction id is already used." },
	REVERSAL_BEFORE_ORIGINAL: {
		exit: 3,
		message: "A reversal cannot be dated before the transaction it reverses.",
	},
	NON_EQUITY_CONTRA: { exit: 3, message: "An opening balance contra must be an equity account." },
	INVALID_PERIOD: { exit: 3, message: "The period's start is after its end." },
	AMOUNT_OVERFLOW: { exit: 3, message: "The total exceeds the safe integer range." },
}
