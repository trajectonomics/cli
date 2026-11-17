import { z } from "zod"
import { checkedDate } from "../date"
import { type AppError, fail, isAppError } from "../errors"

/** One `--age`, repeatable, which needs the birth date the months count from. */
export const ageFlag: z.ZodOptional<z.ZodArray<z.ZodNumber>> = z
	.array(
		z
			.number()
			.int()
			.min(0)
			.describe("An age to report net worth at; repeatable and needs --birth-date."),
	)
	.optional()

/** Exactly one of the second Scenario and `--set` says what B is (ADR-0030). */
export function whatIfProblem(b: string | undefined, sets: readonly string[]): AppError | null {
	if ((b === undefined) === (sets.length === 0)) {
		return fail("invalid_input", {
			path: "b",
			message: "compare needs exactly one of a second Scenario or --set.",
			hint: "Pass a second Scenario name, or --set to compare the first one with a what-if.",
		})
	}
	return null
}

/** The ages a compare asks for, checked against the birth date they need: fail before the store. */
export function agesProblem(
	ages: readonly number[],
	birthDate: string | undefined,
): AppError | null {
	if (ages.length > 0 && birthDate === undefined) {
		return fail("invalid_input", {
			path: "age",
			message: "--age needs --birth-date to know which birthday to read.",
			hint: "Pass --birth-date YYYY-MM-DD beside --age.",
		})
	}
	if (birthDate === undefined) return null
	const checked = checkedDate(birthDate, "birthDate")
	return isAppError(checked) ? checked : null
}
