import type { ScenarioDocument } from "../document"
import { type JsonRecord, records } from "./json"
import { TAX_CONTRIBUTION_LABELS, TAX_INCOME_LABELS } from "./labels"
import { leviesOf, TAX_LEVY_ID } from "./levy"

/** The Tally labels the document's Levies read, so removing one is not done behind another's back. */
function tallyLabelsOf(levies: readonly JsonRecord[]): Set<string> {
	const labels = new Set<string>()
	for (const levy of levies) {
		for (const measure of records(levy["measures"])) {
			if (measure["op"] === "tally" && typeof measure["label"] === "string") {
				labels.add(measure["label"])
			}
		}
	}
	return labels
}

/** A Flow without the tax label it carried, or the same Flow when another Levy still tallies it. */
function unlabelled(flow: JsonRecord, stillRead: Set<string>, taxLabels: Set<string>): JsonRecord {
	const label = flow["label"]
	if (typeof label !== "string" || !taxLabels.has(label) || stillRead.has(label)) return flow
	const { label: _label, ...rest } = flow
	return rest
}

/**
 * The document without this build's tax Levy and without the tax labels it made legal, `null` when
 * it held none. A label another Levy still tallies is left in place: a Flow cannot keep a label no
 * Levy reads, and must not lose one that another Levy does.
 */
export function withoutTaxLevy(document: ScenarioDocument): ScenarioDocument | null {
	const levies = leviesOf(document)
	const kept = levies.filter((levy) => levy["id"] !== TAX_LEVY_ID)
	if (kept.length === levies.length) return null
	const stillRead = tallyLabelsOf(kept)
	const taxLabels = new Set([...TAX_INCOME_LABELS, ...TAX_CONTRIBUTION_LABELS])
	const next: ScenarioDocument = {
		...document,
		flows: records(document["flows"]).map((flow) => unlabelled(flow, stillRead, taxLabels)),
	}
	if (kept.length === 0) delete next["levies"]
	else next["levies"] = kept
	return next
}
