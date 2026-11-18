import type { AccountAmount } from "@trajectonomics/sim"
import { moneyOf } from "./money"

/** The total a Projection could not invest, in minor units; `null` when the sum is not exact. */
function unfundedTotal(unfunded: readonly AccountAmount[]): number | null {
	let total = 0n
	for (const item of unfunded) total += BigInt(item.amount)
	const limit = BigInt(Number.MAX_SAFE_INTEGER)
	if (total > limit || total < -limit) return null
	return Number(total)
}

/**
 * The sentence a Projection with Contributions it could not fund adds to its notes. A Contribution
 * larger than the cash available is not made, so a what-if that looks identical to its base says
 * why rather than leaving the reader to find `unfundedContributions` in a row (cli#150).
 */
export function fundingNotes(
	unfunded: readonly AccountAmount[],
	currency: string,
	side?: "A" | "B",
): string[] {
	const total = unfundedTotal(unfunded)
	if (total === null || total === 0) return []
	const amount = moneyOf(currency)(total)
	if (side === undefined) {
		return [`${amount} of Contributions could not be funded, so they were not made.`]
	}
	return [`Side ${side} could not fund ${amount} of Contributions, so they were not made.`]
}
