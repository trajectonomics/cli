import { counted } from "../counts"
import { type AppError, isAppError } from "../errors"
import { trialBalanceAt } from "../report/balance"
import type { Ledger, Store } from "../store"
import { NO_TRIAL, sentenceOf, skipped, step } from "./checks"
import type { DoctorCheck, DoctorResult } from "./output"

/** The integrity check's row-per-finding answer, `["ok"]` when SQLite found nothing. */
export function integrityCheck(store: Store): DoctorCheck {
	const findings = store.integrity()
	if (isAppError(findings)) return step("integrity", "fail", sentenceOf(findings))
	const healthy = findings.length === 1 && findings[0] === "ok"
	return step(
		"integrity",
		healthy ? "pass" : "fail",
		healthy ? "SQLite found no problem." : findings.join("; "),
	)
}

/** Re-validates every stored Transaction through the ledger core, the read every report makes. */
function ledgerCheck(store: Store): { check: DoctorCheck; ledger?: Ledger } {
	const ledger = store.ledger()
	if (isAppError(ledger)) return { check: step("ledger", "fail", sentenceOf(ledger)) }
	const postings = ledger.transactions.reduce((sum, tx) => sum + tx.postings.length, 0)
	const transactions = ledger.transactions.length
	const detail = `${counted(transactions, "transaction")} and ${counted(postings, "posting")} validate.`
	return { check: step("ledger", "pass", detail), ledger }
}

/** The Trial Balance at the caller's date, and whether each currency's two columns agree. */
function trialCheck(ledger: Ledger, asOf: string) {
	const trial = trialBalanceAt(ledger, asOf)
	if (isAppError(trial)) return trial
	const balanced = trial.totals.every((total) => total.debit === total.credit)
	const detail = balanced
		? `Debits equal credits at ${asOf}.`
		: `Debits and credits disagree at ${asOf}: a currency's totals differ.`
	return {
		check: step("trialBalance", balanced ? "pass" : "fail", detail),
		trialBalance: { asOf, totals: trial.totals, balanced },
	}
}

/**
 * The ledger and trial-balance checks over an opened store, after its integrity check. The date is
 * the caller's, so an invalid one is raised as the input error it is rather than a finding.
 */
export function ledgerChecks(
	store: Store,
	asOf: string | undefined,
): { checks: DoctorCheck[]; trialBalance?: DoctorResult["trialBalance"] | undefined } | AppError {
	const ledger = ledgerCheck(store)
	const checks: DoctorCheck[] = [ledger.check]
	if (asOf === undefined) {
		return { checks: [...checks, skipped("trialBalance", NO_TRIAL)] }
	}
	if (ledger.ledger === undefined) {
		return { checks: [...checks, skipped("trialBalance", "The ledger could not be validated.")] }
	}
	const trial = trialCheck(ledger.ledger, asOf)
	if (isAppError(trial)) return trial
	return { checks: [...checks, trial.check], trialBalance: trial.trialBalance }
}
