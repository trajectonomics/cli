import { type AppError, fail } from "../errors"
import type { ClassProblem } from "./carryin-classes"

/** The record a flag problem came from: its document path, its Levy and its period. */
export type FlagWhere = { base: string; levy: string; periodStart: string }

/** The refusal for a class problem the flag document caused, at the record it came from. */
export function flagProblem(problem: ClassProblem, where: FlagWhere): AppError {
	if (problem.kind === "missing") {
		return fail("invalid_input", {
			path: `${where.base}.tallies`,
			message: `The record for "${where.levy}" from ${where.periodStart} does not name every class the Levy measures.`,
			hint: 'State "0.00" for a class the period had no income in, or "rest": "0.00" to assert they were all zero.',
			details: { levy: where.levy, periodStart: where.periodStart, missing: problem.missing },
		})
	}
	const { index, tally } = problem
	if (problem.kind === "twice") {
		return fail("invalid_input", {
			path: `${where.base}.tallies.${index}.label`,
			message: `The class "${tally.label}" under "${tally.basis}" is stated twice in one record.`,
			hint: 'State each class once; a class with no income is stated as "0.00".',
		})
	}
	return fail("invalid_input", {
		path: `${where.base}.tallies.${index}.label`,
		message: `The Levy "${where.levy}" does not tally the class "${tally.label}" under "${tally.basis}".`,
		hint: "A class no measure reads would be tallied as nothing; name one the Levy measures.",
		details: { levy: where.levy, ...tally },
	})
}

/** The refusal for a stored record's class problem: the Scenario is the input that named it. */
export function storedProblem(
	problem: ClassProblem,
	where: { path: string; levy: string; periodStart: string },
): AppError {
	if (problem.kind === "missing") {
		return fail("invalid_input", {
			path: where.path,
			message: `The stored Carry-in for "${where.levy}" from ${where.periodStart} does not name every class the Levy measures.`,
			hint: 'Re-apply the Scenario with "0.00" for each class it had no income in.',
			details: { levy: where.levy, periodStart: where.periodStart, missing: problem.missing },
		})
	}
	const { tally } = problem
	const what =
		problem.kind === "twice" ? "twice in one record" : ", which the Levy does not measure"
	return fail("invalid_input", {
		path: where.path,
		message: `The stored Carry-in for "${where.levy}" from ${where.periodStart} states the class "${tally.label}" under "${tally.basis}" ${what}.`,
		hint: "Re-apply the Scenario with one entry per class the Levy measures.",
		details: { levy: where.levy, periodStart: where.periodStart },
	})
}
