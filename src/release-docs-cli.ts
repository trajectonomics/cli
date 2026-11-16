#!/usr/bin/env bun
import { readFileSync } from "node:fs"
import { root } from "./commands"
import { checkReleaseDocs, helpNotes, type Mode } from "./release-docs"

/** `traj schema --json` output, as the workflow saves it. Only the listing is read. */
type Schema = { readonly commands?: readonly { readonly name?: string }[] }

const latest = process.env["RELEASE_DOCS_LATEST"]
if (latest === undefined || latest === "") {
	console.error("error: RELEASE_DOCS_LATEST is unset; the workflow reads it from npm.")
	process.exit(1)
}

const mode: Mode = process.env["RELEASE_DOCS_MODE"] === "freshness" ? "freshness" : "pull-request"
const schemaPath = process.env["RELEASE_DOCS_SCHEMA"] ?? "released.json"

const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as Schema
const known = (schema.commands ?? []).flatMap((entry) =>
	entry.name === undefined ? [] : [entry.name],
)
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8")

const problems = checkReleaseDocs(
	{ readme, known, latestVersion: latest, notes: helpNotes(root) },
	mode,
)
for (const problem of problems) {
	const where = problem.line === undefined ? "help" : `README.md:${problem.line}`
	console.error(`${where}: ${problem.message}`)
}
if (problems.length > 0) {
	console.error(
		`${problems.length} release-docs problem(s) against the latest release (${latest}).`,
	)
	process.exit(1)
}
console.log(
	`the README and the help notes agree with the latest release (${latest}), ${mode} mode.`,
)
