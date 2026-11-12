import type { AccountType } from "@trajectonomics/ledger"

/** The two sim-core account kinds. A Baseline declares no kinds; the Scenario does (ADR-0026). */
export type SimKind = "asset" | "liability"

/** Every Baseline this CLI derives is THB (ADR-0005), stated rather than read from rows. */
export const BASELINE_CURRENCY = "THB"

/**
 * The Ledger types that cross into a Baseline. `netWorth` counts assets and liabilities and
 * nothing else: equity is the contra side of an Opening balance, and income and expense are flows
 * whose run-rates are the Scenario's Phase 2. Header Accounts never appear, because the core's
 * Balances query returns leaves only (ADR-0026).
 */
export const CROSSING: Partial<Record<AccountType, SimKind>> = {
	asset: "asset",
	liability: "liability",
}
