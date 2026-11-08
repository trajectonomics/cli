import { reverse } from "@trajectonomics/ledger"
import { chartOf } from "./chart"
import type { Ctx } from "./context"
import { postingsOf } from "./tx-content"
import { coreTransaction, postingInput } from "./tx-core"
import type { NewTransaction, TxRow } from "./types"

// The core needs an id to shape a reversal; the store mints the real one inside the write.
const REVERSAL_DRAFT_ID = "01940000-0000-7000-8000-000000000000"

/** The original's postings in order, every sign flipped, linked to it. */
export function reversalOf(ctx: Ctx, original: TxRow, date: string): NewTransaction {
	const chart = chartOf(ctx)
	const stored = coreTransaction(original, postingsOf(ctx, original.id), chart)
	const reversal = reverse(stored, { id: REVERSAL_DRAFT_ID, date }, chart)
	return {
		date: reversal.date,
		linkedTo: original.id,
		postings: reversal.postings.map(postingInput),
	}
}
