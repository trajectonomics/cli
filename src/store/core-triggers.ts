// Test support for contract.test.ts: the ledger codes no store write can reach, raised by the
// core functions the commands will call directly and mapped by the same `guard` the store uses.
import {
	balances,
	createChartOfAccounts,
	openingBalance,
	profitAndLoss,
	reverse,
	simple,
} from "@trajectonomics/ledger"
import { guard } from "./guard"
import { PERSONAL_ENTITY_ID } from "./ids"

function chart() {
	const account = (id: string, type: "asset" | "equity" | "expense") => ({
		id,
		type,
		currency: "THB",
		entityId: PERSONAL_ENTITY_ID,
	})
	return createChartOfAccounts([
		account("cash", "asset"),
		account("food", "expense"),
		account("opening", "equity"),
	])
}

function lunch(id: string, amount = 100) {
	return simple({ id, date: "2026-03-01", debit: "food", credit: "cash", amount }, chart())
}

type CoreCode =
	| "NEGATIVE_AMOUNT"
	| "DUPLICATE_TRANSACTION_ID"
	| "REVERSAL_BEFORE_ORIGINAL"
	| "NON_EQUITY_CONTRA"
	| "INVALID_PERIOD"
	| "AMOUNT_OVERFLOW"

export function coreOnly(): Record<CoreCode, () => unknown> {
	const max = Number.MAX_SAFE_INTEGER
	return {
		NEGATIVE_AMOUNT: () => guard(() => lunch("t", -1)),
		DUPLICATE_TRANSACTION_ID: () =>
			guard(() => reverse(lunch("t"), { id: "t", date: "2026-03-02" }, chart())),
		REVERSAL_BEFORE_ORIGINAL: () =>
			guard(() => reverse(lunch("t"), { id: "r", date: "2026-01-01" }, chart())),
		NON_EQUITY_CONTRA: () =>
			guard(() =>
				openingBalance(
					{ id: "o", date: "2026-01-01", account: "cash", contra: "food", amount: 1 },
					chart(),
				),
			),
		INVALID_PERIOD: () =>
			guard(() => profitAndLoss([], { from: "2026-02-01", to: "2026-01-01" }, chart())),
		AMOUNT_OVERFLOW: () =>
			guard(() => balances([lunch("a", max), lunch("b", max)], "2026-12-31", chart())),
	}
}
