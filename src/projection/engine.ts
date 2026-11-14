import type { ProjectionProblem } from "@trajectonomics/sim"
import { version as simVersion } from "@trajectonomics/sim/package.json"
import type { AppError } from "../errors"
import { fail } from "../errors"

/** The engine's package and the exact version this build runs on (ADR-0030). */
export const SIM_PACKAGE = "@trajectonomics/sim"

/** The engine version, read from the package that ships it. */
export const SIM_VERSION: string = simVersion

/** One engine problem as the envelope's detail row: the core's code, path, date and account. */
type ProblemDetail = { code: string; path?: string; date?: string; account?: string }

/** The engine's own path, dot-separated the way the envelope spells one. */
export function problemPath(problem: ProjectionProblem): string | undefined {
	if (!("path" in problem)) return undefined
	return problem.path.join(".")
}

function detailOf(problem: ProjectionProblem): ProblemDetail {
	const detail: ProblemDetail = { code: problem.code }
	const path = problemPath(problem)
	if (path !== undefined) detail.path = path
	if ("date" in problem) detail.date = problem.date
	if ("account" in problem && problem.account !== undefined) detail.account = problem.account
	return detail
}

/** A Timeline the engine refuses is the caller's flag, not a refused document (ADR-0030). */
function timelineFailure(problems: readonly ProjectionProblem[]): AppError | null {
	const timeline = problems.find((problem) => "path" in problem && problem.path[0] === "timeline")
	if (timeline === undefined || !("path" in timeline)) return null
	const last = timeline.path.at(-1)
	if (last === "start" || last === "horizon") {
		const flag = last === "start" ? "as-of" : "horizon"
		return fail("invalid_input", {
			path: last === "start" ? "asOf" : "horizon",
			message: `--${flag}: ${timeline.code}`,
			hint: "The Timeline starts at --as-of and ends at --horizon.",
			// Every problem the engine reported, in its order, so a sibling problem is not lost.
			details: problems.map(detailOf),
		})
	}
	return fail("invalid_input", {
		path: `timeline.${String(last ?? "")}`,
		message: `timeline: ${timeline.code}`,
		hint: "The CLI builds the Timeline from --as-of and --horizon.",
		details: { code: timeline.code },
	})
}

/**
 * What the engine refuses becomes `projection_refused` at exit 3, with the engine's codes and
 * paths in `details` in its own order and the first at `path` (ADR-0013, ADR-0030).
 */
export function refusal(problems: readonly ProjectionProblem[]): AppError {
	const timeline = timelineFailure(problems)
	if (timeline !== null) return timeline
	const first = problems[0]
	const path = first === undefined ? undefined : problemPath(first)
	return fail("projection_refused", {
		...(path === undefined ? {} : { path }),
		details: problems.map(detailOf),
		hint: "The Baseline, the Scenario and the Timeline must agree; details lists every problem.",
	})
}
