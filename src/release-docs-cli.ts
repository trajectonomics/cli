#!/usr/bin/env bun
import { root } from "./commands"
import { checkReleaseDocs, helpNotes, type Mode } from "./release-docs"

/** `traj schema --json` output, as the workflow saves it. Only the listing is read. */
type Schema = { readonly commands?: readonly { readonly name?: string }[] }

async function main(): Promise<number> {
	const latest = process.env["RELEASE_DOCS_LATEST"]
	if (latest === undefined || latest === "") {
		console.error("error: RELEASE_DOCS_LATEST is unset; the workflow reads it from npm.")
		return 1
	}
	const mode: Mode = process.env["RELEASE_DOCS_MODE"] === "freshness" ? "freshness" : "pull-request"
	const schema = (await Bun.file("released.json").json()) as Schema
	const known = (schema.commands ?? []).flatMap((entry) =>
		entry.name === undefined ? [] : [entry.name],
	)
	const readme = await Bun.file(new URL("../README.md", import.meta.url)).text()
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
		return 1
	}
	console.log(
		`the README and the help notes agree with the latest release (${latest}), ${mode} mode.`,
	)
	return 0
}

process.exitCode = await main()
