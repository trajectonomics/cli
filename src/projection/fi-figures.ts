import type { FiBestCase, RuleOfThumbReference } from "@trajectonomics/sim"
import type { BestCaseView, RuleOfThumbView } from "./fi-view"
import { moneyOf } from "./money"

/** The engine's reference figures in the CLI's money, with its own terms and window. */
export function referenceView(reference: RuleOfThumbReference, currency: string): RuleOfThumbView {
	const money = moneyOf(currency)
	return {
		label: reference.label,
		date: reference.date,
		multiplier: reference.multiplier,
		basis: reference.basis,
		window: reference.window,
		terms: reference.terms,
		unlockedAssets: money(reference.unlockedAssets),
		numerator: money(reference.numerator),
		annualExpenses: money(reference.annualExpenses),
		threshold: money(reference.threshold),
		multipleBps: reference.multipleBps ?? null,
		partial: reference.partial,
		met: reference.met,
	}
}

export function bestCaseView(bestCase: FiBestCase, currency: string): BestCaseView {
	const money = moneyOf(currency)
	if ("runsOut" in bestCase) {
		return {
			month: bestCase.month,
			runsOut: { date: bestCase.runsOut.date, unmet: money(bestCase.runsOut.unmet) },
		}
	}
	return {
		month: bestCase.month,
		bufferBreach: {
			date: bestCase.bufferBreach.date,
			required: money(bestCase.bufferBreach.required),
			accessible: money(bestCase.bufferBreach.accessible),
		},
	}
}
