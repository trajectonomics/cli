import { type Context, ok, type Result } from "../../command"
import { type AppError, fail, isAppError } from "../../errors"
import { withStore } from "../../with-store"
import { type ScenarioDocument, scenarioDocumentError } from "../document"
import { scenarioNotFound } from "../errors"
import { view, type WrittenScenario } from "../view"
import { type TaxFlags, type TaxRequest, taxRequestOf } from "./flags"
import { type FlowLabel, flowLabelOf } from "./labels"
import { withTaxLevy } from "./levy"
import { withoutTaxLevy } from "./remove"

/** What `scenario tax` returns: the row it wrote, and whether the write was rolled back. */
export type TaxWritten = {
	dryRun: boolean
	status: "created" | "updated" | "unchanged"
	scenario: WrittenScenario
}

/** The flags `scenario tax` takes, as the writer reads them. */
export type TaxInput = TaxFlags & {
	scenario: string
	label?: string[] | undefined
	dryRun?: boolean | undefined
}

/** The labels the caller declared, or the reason one cannot be read. */
function labelsOf(values: readonly string[]): FlowLabel[] | AppError {
	const labels: FlowLabel[] = []
	for (const value of values) {
		const label = flowLabelOf(value)
		if (isAppError(label)) return label
		labels.push(label)
	}
	return labels
}

/** A call that names neither a jurisdiction nor `--none` cannot write or remove anything. */
function noChoice(): AppError {
	return fail("invalid_input", {
		path: "tax",
		message: "scenario tax needs --tax <jurisdiction> to write a Levy, or --none to remove one.",
		hint: "Run --tax th-2026 to apply Thailand's 2026 income tax.",
	})
}

/** `--none` removes the Levy and its labels, so a label to write is a contradiction. */
function noneWithLabel(input: TaxInput): AppError | null {
	if (input.none !== true || (input.label ?? []).length === 0) return null
	return fail("invalid_input", {
		path: "label",
		message: "--none removes the tax, so it cannot be combined with --label.",
	})
}

/** The document the caller asked for, `null` when `--none` found no tax Levy to remove. */
function nextOf(
	document: ScenarioDocument,
	request: TaxRequest | null,
	labels: readonly FlowLabel[],
): ScenarioDocument | null | AppError {
	return request === null ? withoutTaxLevy(document) : withTaxLevy(document, request, labels)
}

/** Checks the document with its Levy in it, then writes it; the engine's rules decide the refusal. */
function save(
	store: Parameters<Parameters<typeof withStore>[1]>[0],
	name: string,
	document: ScenarioDocument,
	dryRun: boolean,
): Result<TaxWritten> | AppError {
	const refused = scenarioDocumentError(document)
	if (refused !== null) return refused
	const outcome = store.saveScenario({ name, document }, { dryRun })
	if (isAppError(outcome)) return outcome
	const scenario = view(outcome.scenario)
	const id = dryRun && outcome.status === "created" ? null : scenario.id
	return ok({ dryRun, status: outcome.status, scenario: { ...scenario, id } })
}

/** The one write `scenario tax` makes, with every refusal ahead of it. */
export function writeTax(input: TaxInput, ctx: Context): Result<TaxWritten> | AppError {
	const request = taxRequestOf(input)
	if (isAppError(request)) return request
	if (request === null && input.none !== true) return noChoice()
	const contradictory = noneWithLabel(input)
	if (contradictory !== null) return contradictory
	const labels = labelsOf(input.label ?? [])
	if (isAppError(labels)) return labels
	const dryRun = input.dryRun === true
	return withStore(ctx, (store) => {
		const row = store.getScenario(input.scenario)
		if (isAppError(row)) return row
		if (row === null) return scenarioNotFound(input.scenario, "scenario")
		const document = JSON.parse(row.document) as ScenarioDocument
		const next = nextOf(document, request, labels)
		if (isAppError(next)) return next
		if (next === null) return ok({ dryRun, status: "unchanged" as const, scenario: view(row) })
		return save(store, row.name, next, dryRun)
	})
}
