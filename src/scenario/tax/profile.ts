import { ThLevyContributionLabel } from "@trajectonomics/tax/th"
import type { ScenarioDocument } from "../document"
import { ALLOWANCE_FLAGS } from "./allowances"
import type { TaxRequest } from "./flags"
import { flowsOf } from "./labels"

/**
 * The allowance classes this build can model, in the order a `scenario tax` result lists them.
 * `retirementContributions` and `thaiEsg` are not flags: they arrive as labelled contribution
 * Flows, which the Levy tallies instead (ADR-0032).
 */
export const TAX_ALLOWANCE_CLASSES = [
	"personal",
	"spouse",
	"children",
	"parents",
	"disabledCare",
	"socialSecurity",
	"lifeInsurance",
	"healthInsurance",
	"parentHealthInsurance",
	"spouseLifeInsurance",
	"mortgageInterest",
	"donation2x",
	"donation1x",
	"retirementContributions",
	"thaiEsg",
] as const

export type TaxAllowanceClass = (typeof TAX_ALLOWANCE_CLASSES)[number]

/** What a written Levy models, and what this build supports but the caller did not state. */
export type TaxProfileView = {
	modelled: TaxAllowanceClass[]
	notModelled: TaxAllowanceClass[]
}

/** Whether a contribution Flow in the document carries any of these tally labels. */
function carriesLabel(document: ScenarioDocument, labels: readonly string[]): boolean {
	const carried = new Set(labels)
	return flowsOf(document).some(
		(flow) => flow["kind"] === "contribution" && carried.has(String(flow["label"] ?? "")),
	)
}

const RETIREMENT_LABELS: readonly string[] = [
	ThLevyContributionLabel.Rmf,
	ThLevyContributionLabel.Ssf,
	ThLevyContributionLabel.Pvd,
	ThLevyContributionLabel.Gpf,
	ThLevyContributionLabel.Nsf,
	ThLevyContributionLabel.PensionLifeInsurance,
]

/**
 * The allowances one written Levy models. A class is modelled when the Levy reads it from the
 * profile or from a labelled contribution Flow, so a caller who has life insurance but did not
 * state it is told the figure leaves it out rather than left to assume a zero.
 */
export function taxProfileOf(request: TaxRequest, document: ScenarioDocument): TaxProfileView {
	const stated = new Set<TaxAllowanceClass>(["personal"])
	if (
		request.filingStatus === "married_no_income_spouse" ||
		request.filingStatus === "married_joint"
	) {
		stated.add("spouse")
	}
	if (request.children > 0) stated.add("children")
	for (const field of ALLOWANCE_FLAGS) {
		if (request.allowances[field] > 0) stated.add(field as TaxAllowanceClass)
	}
	if (carriesLabel(document, RETIREMENT_LABELS)) stated.add("retirementContributions")
	if (carriesLabel(document, [ThLevyContributionLabel.ThaiEsg])) stated.add("thaiEsg")
	return {
		modelled: TAX_ALLOWANCE_CLASSES.filter((it) => stated.has(it)),
		notModelled: TAX_ALLOWANCE_CLASSES.filter((it) => !stated.has(it)),
	}
}
