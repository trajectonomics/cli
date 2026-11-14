import {
	type FiBestCase,
	financialIndependence,
	type RuleOfThumbReference,
} from "@trajectonomics/sim"
import type { AppError } from "../errors"
import { isAppError } from "../errors"
import { echoOf } from "./echo"
import { refusal } from "./engine"
import type { BestCaseView, FiAnswer, FiView, RuleOfThumbView } from "./fi-view"
import { moneyOf } from "./money"
import type { Prepared } from "./prepare"

function referenceView(reference: RuleOfThumbReference, currency: string): RuleOfThumbView {
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

function bestCaseView(bestCase: FiBestCase, currency: string): BestCaseView {
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

/** The engine's survival answer in the CLI's money: reachable, no candidate month, or a binding. */
export function fiAnswerOf(prepared: Prepared): FiAnswer | AppError {
	const result = financialIndependence(prepared.baseline, prepared.document, prepared.timeline, {
		method: "survival",
	})
	if (!result.ok) return refusal(result.problems)
	const answer = result.financialIndependence
	if (answer.reachable) {
		return {
			reachable: true,
			fiDate: answer.month,
			reference: referenceView(answer.reference, prepared.currency),
		}
	}
	if (answer.binding === "noCandidateMonth") return { reachable: false, binding: answer.binding }
	return {
		reachable: false,
		binding: answer.binding,
		bestCase: bestCaseView(answer.bestCase, prepared.currency),
	}
}

/** `traj fi`: the survival answer with its definition echoed (ADR-0008). */
export function independenceOf(prepared: Prepared): FiView | AppError {
	const fi = fiAnswerOf(prepared)
	if (isAppError(fi)) return fi
	return {
		...echoOf(prepared),
		horizon: prepared.timeline.horizon,
		currency: prepared.currency,
		method: "survival",
		definition: { method: "survival", definitionVersion: 1 },
		fi,
	}
}
