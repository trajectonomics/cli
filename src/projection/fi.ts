import {
	type FiBestCase,
	financialIndependence,
	project,
	type RuleOfThumbReference,
} from "@trajectonomics/sim"
import type { AppError } from "../errors"
import { isAppError } from "../errors"
import type { Placed } from "./carryin-apply"
import { echoOf } from "./echo"
import { refusal } from "./engine"
import type { BestCaseView, FiAnswer, FiView, RuleOfThumbView } from "./fi-view"
import { moneyOf } from "./money"
import { taxYearsOf } from "./tax-view"

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

/** The engine's survival answer in the CLI's money, with its own definition echo (ADR-0008). */
export type FiSolution = {
	fi: FiAnswer
	definition: { method: "survival"; definitionVersion: number }
}

export function fiAnswerOf(prepared: Placed): FiSolution | AppError {
	const result = financialIndependence(prepared.baseline, prepared.document, prepared.timeline, {
		method: "survival",
	})
	if (!result.ok) return refusal(result.problems)
	const answer = result.financialIndependence
	const definition = {
		method: answer.definition.method,
		definitionVersion: answer.definition.definitionVersion,
	}
	if (answer.reachable) {
		return {
			fi: {
				reachable: true,
				fiDate: answer.month,
				reference: referenceView(answer.reference, prepared.currency),
			},
			definition,
		}
	}
	if (answer.binding === "noCandidateMonth") {
		return { fi: { reachable: false, binding: answer.binding }, definition }
	}
	return {
		fi: {
			reachable: false,
			binding: answer.binding,
			bestCase: bestCaseView(answer.bestCase, prepared.currency),
		},
		definition,
	}
}

/** `traj fi`: the survival answer with its definition echoed (ADR-0008). */
export function independenceOf(prepared: Placed): FiView | AppError {
	const solution = fiAnswerOf(prepared)
	if (isAppError(solution)) return solution
	// The FI answer does not carry a Projection, so the tax it implies is read from one run of the
	// same inputs the survival scan used (ADR-0036).
	const result = project(prepared.baseline, prepared.document, prepared.timeline)
	if (!result.ok) return refusal(result.problems)
	return {
		...echoOf(prepared),
		horizon: prepared.timeline.horizon,
		currency: prepared.currency,
		method: solution.definition.method,
		definition: solution.definition,
		fi: solution.fi,
		taxYears: taxYearsOf(result.projection.levies, prepared.currency),
	}
}
