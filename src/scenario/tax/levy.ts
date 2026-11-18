import { emitThLevy } from "@trajectonomics/tax/th"
import { type AppError, fail, isAppError } from "../../errors"
import type { ScenarioDocument } from "../document"
import type { TaxRequest } from "./flags"
import { type JsonRecord, records } from "./json"
import {
	type FlowLabel,
	mislabelledContributions,
	TAX_CONTRIBUTION_LABELS,
	TAX_INCOME_LABELS,
	unlabelledIncome,
	withFlowLabels,
} from "./labels"

/** The Levy id the CLI writes, and the one whose jurisdictions its notes may name. */
export const TAX_LEVY_ID: string = "th-2026-pit"

/** The Levies a document declares, as JSON records, in document order. */
export function leviesOf(document: ScenarioDocument): JsonRecord[] {
	return records(document["levies"])
}

/** The Levy this build would write for a request; `AppError` when tax-core refuses the profile. */
function levyOf(request: TaxRequest): JsonRecord | AppError {
	if (request.jurisdiction !== "th-2026") {
		return fail("invalid_input", {
			message: `--tax ${request.jurisdiction} is not a jurisdiction this build applies.`,
			path: "tax",
		})
	}
	try {
		const levy = emitThLevy({
			filingStatus: request.filingStatus,
			allowances: {
				children: {
					totalCount: request.children,
					secondPlusBorn2018OrLaterCount: request.childrenAtHigherRate,
				},
				parents: request.allowances.parents,
				disabledCareCount: request.allowances.disabledCare,
				socialSecurity: request.allowances.socialSecurity,
				lifeInsurance: request.allowances.lifeInsurance,
				healthInsurance: request.allowances.healthInsurance,
				parentHealthInsurance: request.allowances.parentHealthInsurance,
				spouseLifeInsurance: request.allowances.spouseLifeInsurance,
				mortgageInterest: request.allowances.mortgageInterest,
				donation2x: request.allowances.donation2x,
				donation1x: request.allowances.donation1x,
			},
			levy: { id: TAX_LEVY_ID },
		})
		return levy as unknown as JsonRecord
	} catch (error) {
		return fail("invalid_input", {
			message: error instanceof Error ? error.message : "--tax could not build this profile.",
			path: "tax",
		})
	}
}

/** The refusal for a document whose Flows tax-core would tally as nothing, or `null` when it is clear. */
function labelRefusal(document: ScenarioDocument): AppError | null {
	const unlabelled = unlabelledIncome(document)
	if (unlabelled.length > 0) {
		return fail("invalid_input", {
			message: `With --tax, every income Flow needs a label from @trajectonomics/tax/th; ${
				unlabelled.length === 1 ? "one Flow has" : `${unlabelled.length} Flows have`
			} none this build recognises, so tax on them would be zero.`,
			path: "document",
			details: { flows: unlabelled, labels: TAX_INCOME_LABELS },
		})
	}
	if (mislabelledContributions(document).length > 0) {
		return fail("invalid_input", {
			message:
				"A contribution Flow carries a label tax-core does not read, so a retirement allowance would be silently missing.",
			path: "document",
			details: { flows: mislabelledContributions(document), labels: TAX_CONTRIBUTION_LABELS },
		})
	}
	return null
}

/**
 * The document with this build's tax Levy written in place of any it already held. Re-applying is
 * how a caller changes the profile, so the old Levy is replaced rather than treated as a conflict.
 */
export function withTaxLevy(
	document: ScenarioDocument,
	request: TaxRequest,
	labels: readonly FlowLabel[],
): ScenarioDocument | AppError {
	const levy = levyOf(request)
	if (isAppError(levy)) return levy
	const labelled = withFlowLabels(document, labels)
	if (isAppError(labelled)) return labelled
	const refused = labelRefusal(labelled)
	if (refused !== null) return refused
	const kept = leviesOf(labelled).filter((it) => it["id"] !== TAX_LEVY_ID)
	return { ...labelled, levies: [...kept, levy] }
}
