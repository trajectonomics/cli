import { type AppError, fail } from "../errors"

/** A lookup miss for any Scenario command; `path` names the input field that held the word. */
export function scenarioNotFound(what: string, path = "scenario"): AppError {
	return fail("not_found", {
		path,
		message: `No scenario matches "${what}".`,
		details: { resource: "scenario" },
		hint: 'Run "traj scenario list" to see the scenarios.',
	})
}

/** A new name that a live Scenario already holds (ADR-0021). */
export function scenarioNameTaken(id: string): AppError {
	return fail("scenario_name_taken", {
		path: "name",
		message: "A scenario with this name already exists.",
		details: { scenarioId: id },
	})
}

/** A new name shaped like a UUID would shadow the id-first resolution (ADR-0018). */
export function invalidScenarioName(): AppError {
	return fail("invalid_input", {
		path: "name",
		message: "name: a scenario name cannot be shaped like a UUID",
	})
}
