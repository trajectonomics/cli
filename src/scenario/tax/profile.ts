import { ThLevyContributionLabel } from "@trajectonomics/tax/th"
import type { ScenarioDocument } from "../document"
import { ALLOWANCE_FLAGS, type TaxAllowances } from "./allowances"
import type { TaxRequest } from "./flags"
import { records } from "./json"
import { flowsOf } from "./labels"
import { leviesOf, TAX_LEVY_ID } from "./levy"

/**
 * The deduction classes a `scenario tax` write can state, in the order the result lists them.
 * `personal` and `spouse` are not here: they follow the statute and the filing status, so there is
 * no flag a caller could leave out. `retirementContributions` and `thaiEsg` are not flags either:
 * they arrive as labelled contribution Flows, which the Levy tallies instead (ADR-0032).
 */
export const TAX_ALLOWANCE_CLASSES: readonly [
	"children",
	...(keyof TaxAllowances)[],
	"retirementContributions",
	"thaiEsg",
] = ["children", ...ALLOWANCE_FLAGS, "retirementContributions", "thaiEsg"]

export type TaxAllowanceClass = (typeof TAX_ALLOWANCE_CLASSES)[number]

/**
 * The classes the flags stated and the ones this build supports but the write left out. It is not
 * an eligibility claim: `@trajectonomics/tax` applies every statutory ceiling and eligibility rule
 * (a spouse life insurance premium stated by a single filer is read and clamped to zero), and the
 * CLI would have to reimplement those rules to say what the Levy applied (ADR-0036).
 */
export type TaxProfileView = {
	stated: TaxAllowanceClass[]
	notStated: TaxAllowanceClass[]
}

/** The contribution labels the CLI's Levy reads, from the Levy's own tally measures. */
function fundedLabelsOf(document: ScenarioDocument): Set<string> {
	const levy = leviesOf(document).find((it) => it["id"] === TAX_LEVY_ID)
	const labels = new Set<string>()
	for (const measure of records(levy?.["measures"])) {
		if (measure["op"] === "tally" && measure["basis"] === "funded") {
			labels.add(String(measure["label"] ?? ""))
		}
	}
	return labels
}

/** The labels the document's contribution Flows carry. */
function contributionLabelsOf(document: ScenarioDocument): Set<string> {
	const labels = new Set<string>()
	for (const flow of flowsOf(document)) {
		const label = flow["label"]
		if (flow["kind"] === "contribution" && typeof label === "string") labels.add(label)
	}
	return labels
}

/**
 * The allowance classes one written Levy states. A contribution class is stated only when the
 * Levy reads its label and a Flow carries it, which is read from the emitted graph rather than
 * restated here. A flag-stated amount is "stated" even where tax-core then clamps or, for an
 * ineligible filer, zeroes it: this reports what the write was told, never what it applied.
 */
export function taxProfileOf(request: TaxRequest, document: ScenarioDocument): TaxProfileView {
	const stated = new Set<TaxAllowanceClass>()
	if (request.children > 0) stated.add("children")
	for (const field of ALLOWANCE_FLAGS) {
		if (request.allowances[field] > 0) stated.add(field)
	}
	const read = fundedLabelsOf(document)
	const carried = contributionLabelsOf(document)
	for (const label of carried) {
		if (!read.has(label)) continue
		if (label === ThLevyContributionLabel.ThaiEsg) stated.add("thaiEsg")
		else stated.add("retirementContributions")
	}
	return {
		stated: TAX_ALLOWANCE_CLASSES.filter((it) => stated.has(it)),
		notStated: TAX_ALLOWANCE_CLASSES.filter((it) => !stated.has(it)),
	}
}
