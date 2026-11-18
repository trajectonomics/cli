import { TH_LEVY_CONTRIBUTION_LABELS, TH_LEVY_INCOME_LABELS } from "@trajectonomics/tax/th"
import { type AppError, fail } from "../../errors"
import type { ScenarioDocument } from "../document"
import { type JsonRecord, records } from "./json"

/*
 * A Tally label is the only thing a Levy knows about a Flow, and `sim-core` refuses a label no
 * Levy reads. So the CLI writes both at once: the Levy, and the labels the caller declared. A
 * label the caller leaves out is not a zero-tax fact but a missing classification, and it is
 * refused by name rather than tallied as nothing.
 */

/** The labels tax-core reads off income and contribution Flows, for a refusal that teaches. */
export const TAX_INCOME_LABELS: readonly string[] = TH_LEVY_INCOME_LABELS
export const TAX_CONTRIBUTION_LABELS: readonly string[] = TH_LEVY_CONTRIBUTION_LABELS

/**
 * The two closed sets in one sentence, so the `--label` flag and the Scenario document's `label`
 * field both name them from here (ADR-0010, ADR-0032).
 */
export function labelSetsSentence(): string {
	return [
		`An income Flow takes one of ${TAX_INCOME_LABELS.join(", ")}.`,
		`A contribution Flow takes one of ${TAX_CONTRIBUTION_LABELS.join(", ")}.`,
	].join(" ")
}

/** One `--label flow=label`, the classification the Levy tallies this Flow under. */
export type FlowLabel = { flow: string; label: string }

/** The Flows a document declares, as JSON records. */
export function flowsOf(document: ScenarioDocument): JsonRecord[] {
	return records(document["flows"])
}

/** A `--label flow=label` value, or the reason it cannot be read. */
export function flowLabelOf(value: string): FlowLabel | AppError {
	const at = value.indexOf("=")
	if (at <= 0 || at === value.length - 1) {
		return fail("invalid_input", {
			message: "--label reads <flow>=<label>, such as salary=income.section40_1.",
			path: "label",
		})
	}
	return { flow: value.slice(0, at), label: value.slice(at + 1) }
}

/** The labels a Flow of this kind may carry, or `null` when the kind is never tallied for tax. */
function allowedLabels(kind: unknown): readonly string[] | null {
	if (kind === "income") return TAX_INCOME_LABELS
	if (kind === "contribution") return TAX_CONTRIBUTION_LABELS
	return null
}

/** One label written onto a Flow, or the refusal that names what the caller may write instead. */
function labelProblem(flow: string, target: JsonRecord, label: string): AppError | null {
	const allowed = allowedLabels(target["kind"])
	if (allowed === null) {
		return fail("invalid_input", {
			message: `--label applies to income and contribution Flows; "${flow}" is a ${String(target["kind"])} Flow.`,
			path: "label",
		})
	}
	if (allowed.includes(label)) return null
	return fail("invalid_input", {
		message: `"${label}" is not a label @trajectonomics/tax reads for a ${String(target["kind"])} Flow.`,
		path: "label",
		details: { labels: allowed },
	})
}

/**
 * The document with the caller's labels written onto its Flows. The label's set is decided by the
 * Flow's kind, so an income Flow can never be given a retirement allowance's label by mistake, and
 * a Flow the document does not declare is refused rather than silently ignored.
 */
export function withFlowLabels(
	document: ScenarioDocument,
	labels: readonly FlowLabel[],
): ScenarioDocument | AppError {
	if (labels.length === 0) return document
	const flows = flowsOf(document)
	const byId = new Map(flows.map((flow) => [String(flow["id"] ?? ""), flow]))
	const written = new Map<string, string>()
	for (const { flow, label } of labels) {
		const target = byId.get(flow)
		if (target === undefined) {
			return fail("invalid_input", {
				message: `--label names the Flow "${flow}", which this Scenario does not declare.`,
				path: "label",
				details: { flows: [...byId.keys()] },
			})
		}
		const problem = labelProblem(flow, target, label)
		if (problem !== null) return problem
		written.set(flow, label)
	}
	return {
		...document,
		flows: flows.map((flow) => {
			const label = written.get(String(flow["id"] ?? ""))
			return label === undefined ? flow : { ...flow, label }
		}),
	}
}

/** Every income Flow that would be tallied under no label, so the Levy would charge nothing for it. */
export function unlabelledIncome(document: ScenarioDocument): string[] {
	const known = new Set(TAX_INCOME_LABELS)
	return flowsOf(document)
		.filter((flow) => flow["kind"] === "income")
		.filter((flow) => {
			const label = flow["label"]
			return typeof label !== "string" || !known.has(label)
		})
		.map((flow) => String(flow["id"] ?? ""))
}

/** Contribution Flows whose label tax-core would read as a retirement allowance but does not know. */
export function mislabelledContributions(document: ScenarioDocument): string[] {
	const known = new Set(TAX_CONTRIBUTION_LABELS)
	return flowsOf(document)
		.filter((flow) => flow["kind"] === "contribution")
		.filter((flow) => {
			const label = flow["label"]
			return typeof label === "string" && !known.has(label)
		})
		.map((flow) => String(flow["id"] ?? ""))
}
