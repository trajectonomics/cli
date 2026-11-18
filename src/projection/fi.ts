import { financialIndependence, project } from "@trajectonomics/sim"
import type { AppError } from "../errors"
import { isAppError } from "../errors"
import type { Placed } from "./carryin-apply"
import { echoOf } from "./echo"
import { refusal } from "./engine"
import { bestCaseView, referenceView } from "./fi-figures"
import type { FiAnswer, FiView } from "./fi-view"
import { fundingNotes } from "./funding"
import { taxYearsOf } from "./tax-view"

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
		notes: [
			...prepared.notes,
			...fundingNotes(result.projection.unfundedContributions, prepared.currency),
		],
		horizon: prepared.timeline.horizon,
		currency: prepared.currency,
		method: solution.definition.method,
		definition: solution.definition,
		fi: solution.fi,
		taxYears: taxYearsOf(result.projection.levies, prepared.currency),
	}
}
