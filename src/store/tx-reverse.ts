import { reverse, type Transaction } from "@trajectonomics/ledger"
import { chartOf } from "./chart"
import type { Ctx } from "./context"
import { postingsOf } from "./tx-content"
import { coreTransaction, postingInput } from "./tx-core"
import type { NewTransaction, TxCorrection, TxRow } from "./types"

// The core needs an id to shape a reversal; the store mints the real one inside the write.
const REVERSAL_DRAFT_ID = "01940000-0000-7000-8000-000000000000"

/**
 * One correction row: the core's transaction as the store's new row, linked to the original and
 * named by its kind, so no linked row is ever written without saying what it is.
 */
export function correctionInput(
	tx: Transaction,
	linkedTo: string,
	kind: TxCorrection,
	metadata: Pick<NewTransaction, "memo" | "externalRef"> = {},
): NewTransaction {
	const memo = metadata.memo === undefined ? {} : { memo: metadata.memo }
	const externalRef =
		metadata.externalRef === undefined ? {} : { externalRef: metadata.externalRef }
	return {
		date: tx.date,
		postings: tx.postings.map(postingInput),
		linkedTo,
		correctionKind: kind,
		...memo,
		...externalRef,
	}
}

/** The original's postings in order, every sign flipped, linked to it as its reversal. */
export function reversalOf(ctx: Ctx, original: TxRow, date: string): NewTransaction {
	const chart = chartOf(ctx)
	const stored = coreTransaction(original, postingsOf(ctx, original.id), chart)
	const reversal = reverse(stored, { id: REVERSAL_DRAFT_ID, date }, chart)
	return correctionInput(reversal, original.id, "reversal")
}
