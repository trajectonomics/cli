import { LedgerValidationError } from "@trajectonomics/ledger"
import type { AppError } from "../errors"
import { ledgerFailure } from "../store"

/**
 * Core output prefixes, rewritten to the keys of one Command's own result. Longest first, so a
 * more specific prefix always wins over the key it starts with. The trailing `[` is kept when the
 * core names a row.
 */
export type FieldRules = readonly (readonly [corePrefix: string, resultPrefix: string])[]

/** `[<entityId>/THB]` names a pair the result reports as a currency alone. */
const PAIR = /\[[^/\]]+\//

/**
 * The core's output path, respelled so `path` names something the caller has. The core's own
 * field is kept in `details` by `ledgerFailure`; only the envelope's `path` is rewritten.
 */
export function respell(field: string, rules: FieldRules): string {
	const path = field.replace(PAIR, "[")
	const rule = rules.find(([prefix]) => path.startsWith(prefix))
	return rule === undefined ? path : `${rule[1]}${path.slice(rule[0].length)}`
}

/** Runs one core query, mapping its rejection into this Command's own result field. */
export function query<T>(work: () => T, rules: FieldRules): T | AppError {
	try {
		return work()
	} catch (error) {
		if (!(error instanceof LedgerValidationError)) throw error
		return ledgerFailure(error, respell(error.field, rules))
	}
}
