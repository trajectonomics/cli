import type { ProjectionRunView, ProjectionTable } from "./projection/run-view"
import type { Captured } from "./test-support"

/** A `projection run` result, parsed from its JSON and typed by the command's own schema. */
export function runBody(res: Captured): ProjectionRunView {
	return JSON.parse(res.out) as ProjectionRunView
}

/** One table of the result, by name; fails the test with a useful message when it is absent. */
export function tableOf<Name extends ProjectionTable["name"]>(
	body: ProjectionRunView,
	name: Name,
): Extract<ProjectionTable, { name: Name }> {
	const table = body.tables.find((entry) => entry.name === name)
	if (table === undefined) throw new Error(`the result has no ${name} table`)
	return table as Extract<ProjectionTable, { name: Name }>
}
