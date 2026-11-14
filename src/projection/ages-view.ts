import { z } from "zod"
import { moneyField } from "./money"

/** Net worth at one age: nominal and real, each null when that birthday has no figure. */
export type AgeFigure = { age: number; nominal: string | null; real: string | null }

/** One entry per `--age`, in the order the caller gave them. */
export function ageFigures(what: string): z.ZodType<AgeFigure[]> {
	return z
		.array(
			z.strictObject({
				age: z.number().int().describe("The age asked for with --age."),
				nominal: moneyField(what).nullable(),
				real: moneyField("The same figure in start-of-timeline terms").nullable(),
			}),
		)
		.describe("One entry per --age, in the order given.")
}
