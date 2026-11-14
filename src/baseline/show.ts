import type { Context, Result } from "../command"
import { checkedAsOf } from "../date"
import type { AppError } from "../errors"
import { isAppError } from "../errors"
import { withLedger } from "../report/with-ledger"
import type { Ledger } from "../store"
import { formatMinorUnits } from "../store"
import { BASELINE_CURRENCY } from "./kind"
import { baselineOf } from "./mapping"
import type { BaselineShow } from "./view"

/** The mapping's document rendered as the CLI's own result: decimal strings plus a currency. */
export function baselineShowOf(ledger: Ledger, asOf: string): BaselineShow | AppError {
	const mapping = baselineOf(ledger, asOf)
	if (isAppError(mapping)) return mapping
	const rows = mapping.balances.map((balance) => ({
		account: balance.account,
		kind: balance.kind,
		amount: formatMinorUnits(balance.amount, BASELINE_CURRENCY),
	}))
	return { asOf, currency: BASELINE_CURRENCY, rows }
}

/**
 * `traj baseline show`: one assembled read of the Ledger, then the mapping. The As-of is checked
 * before the store is opened, so a bad date wins over a corrupt stored Transaction (ADR-0029).
 */
export function baselineShow(ctx: Context, asOf: string): Result<BaselineShow> | AppError {
	const checked = checkedAsOf(asOf)
	if (isAppError(checked)) return checked
	return withLedger(ctx, (ledger) => baselineShowOf(ledger, asOf))
}
