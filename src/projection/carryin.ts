import type { TallyBasis } from "@trajectonomics/sim"
import { z } from "zod"
import { parseDocument, readDocument } from "../document"
import { type AppError, isAppError } from "../errors"
import { CARRY_IN_BASES } from "./carryin-view"

/*
 * `--carry-in` is one JSON document the caller states (ADR-0032): what each Levy's period had
 * already tallied and prepaid before the As-of. It is an input of the command, not a part of the
 * stored Scenario, because the same plan projected from two dates needs two answers.
 */

/**
 * The input field a whole-document failure names. It is the schema field, not the flag, because
 * the dispatch step rewrites a command-raised path to the caller's spelling (`--carry-in`) and
 * adds its help hint (ADR-0013); a path spelled as a flag would bypass both.
 */
export const CARRY_IN_FIELD: string = "carryIn"

/** One class a period tallied: the label, the basis the Levy tallies it under, and the amount. */
export type CarryInTallyForm = { label: string; basis: TallyBasis; amount: string }

/** One record the caller states for one Scenario and one Levy. */
export type CarryInRecordForm = {
	scenario: string
	levy: string
	periodStart: string
	tallies: CarryInTallyForm[]
	prepaid: string
	/** The caller's assertion that every class the record does not name tallied zero. */
	rest?: string | undefined
}

/** A money figure, as every other input states one: a decimal string at the currency's scale. */
const amount = z.string().describe('A decimal string at the currency\'s own scale, as "1234.56".')

const tallyForm: z.ZodType<CarryInTallyForm> = z.strictObject({
	label: z.string().min(1).describe("A Tally label one of the Levy's own measures reads."),
	basis: z.enum(CARRY_IN_BASES).describe("The basis that measure tallies it under."),
	amount,
})

const recordForm: z.ZodType<CarryInRecordForm> = z.strictObject({
	scenario: z.string().min(1).describe("The Scenario's exact name or its id."),
	levy: z.string().min(1).describe("The Levy's id, as the Scenario spells it."),
	periodStart: z.string().min(1).describe("The period's first day, as YYYY-MM-DD."),
	tallies: z.array(tallyForm).describe("What that period tallied, class by class."),
	prepaid: amount.describe(
		"What that period had already prepaid, as a decimal string at the currency's scale.",
	),
	rest: amount
		.optional()
		.describe(
			'Asserts every class the record does not name tallied zero, as a decimal string "0.00".',
		),
})

/**
 * The one record `traj schema` publishes as the example, so the shape is read from one place. It
 * is a document `carryInDocument` accepts, which a test proves: an example the tool would refuse
 * teaches the wrong shape.
 */
export const CARRY_IN_EXAMPLE: readonly CarryInRecordForm[] = [
	{
		scenario: "base",
		levy: "th-2026",
		periodStart: "2025-01-01",
		tallies: [{ label: "income.section40_1", basis: "gross", amount: "780000.00" }],
		prepaid: "0.00",
		rest: "0.00",
	},
]

/** The `--carry-in` document: a flat list of records, one per Scenario, Levy and period. */
export const carryInDocument: z.ZodType<readonly CarryInRecordForm[]> = z.array(recordForm).meta({
	description:
		"A JSON array of records, one per Scenario, Levy and period, each stating what that period had already tallied and prepaid before the As-of.",
	examples: [CARRY_IN_EXAMPLE],
})

/** Reads and validates the flag's document, before the Store opens (ADR-0020, ADR-0030). */
export async function readCarryIn(
	ref: string,
	stdin: () => Promise<string>,
): Promise<readonly CarryInRecordForm[] | AppError> {
	const text = await readDocument(ref, CARRY_IN_FIELD, stdin)
	if (isAppError(text)) return text
	const parsed = parseDocument(
		{ flag: CARRY_IN_FIELD, schema: carryInDocument },
		text,
		CARRY_IN_FIELD,
	)
	return parsed
}
