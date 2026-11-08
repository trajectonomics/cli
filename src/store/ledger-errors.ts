import type { LedgerErrorCode, LedgerValidationError } from "@trajectonomics/ledger"
import { type AppError, type ErrorCode, fail } from "../errors"

// Exhaustive on purpose: a core release that adds a code fails typecheck here instead of
// silently reaching the caller as `internal`.
const LEDGER_CODES: Record<LedgerErrorCode, ErrorCode> = {
	SINGLE_POSTING: "SINGLE_POSTING",
	INVALID_AMOUNT: "INVALID_AMOUNT",
	ZERO_AMOUNT_POSTING: "ZERO_AMOUNT_POSTING",
	UNKNOWN_ACCOUNT: "UNKNOWN_ACCOUNT",
	NON_LEAF_ACCOUNT: "NON_LEAF_ACCOUNT",
	CURRENCY_MISMATCH: "CURRENCY_MISMATCH",
	UNBALANCED_TRANSACTION: "UNBALANCED_TRANSACTION",
	INVALID_DATE: "INVALID_DATE",
	INVALID_CURRENCY: "INVALID_CURRENCY",
	INVALID_DIMENSION: "INVALID_DIMENSION",
	INVALID_ACCOUNT_HIERARCHY: "INVALID_ACCOUNT_HIERARCHY",
	NEGATIVE_AMOUNT: "NEGATIVE_AMOUNT",
	DUPLICATE_TRANSACTION_ID: "DUPLICATE_TRANSACTION_ID",
	REVERSAL_BEFORE_ORIGINAL: "REVERSAL_BEFORE_ORIGINAL",
	NON_EQUITY_CONTRA: "NON_EQUITY_CONTRA",
	INVALID_PERIOD: "INVALID_PERIOD",
	AMOUNT_OVERFLOW: "AMOUNT_OVERFLOW",
}

/** `postings[1].accountId` → `postings.1.accountId`, the envelope's dot-separated path. */
export function dotPath(field: string): string {
	return field.replace(/\[(\d+)\]/g, ".$1").replace(/^\./, "")
}

/** The core's rejection as an envelope: its code verbatim, its field as `path`, the rest in details. */
export function fromLedgerError(error: LedgerValidationError): AppError {
	const path = dotPath(error.field)
	const details = { field: path, value: error.value ?? null, reason: error.reason }
	const options = { message: `${path}: ${error.reason}`, details }
	return fail(LEDGER_CODES[error.code], path === "" ? options : { ...options, path })
}
