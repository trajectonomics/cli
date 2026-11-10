import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { tempHome } from "./store/testing"
import { type Captured, capture } from "./test-support"

/** A fresh data directory for one Scenario test. */
export function scenarioHome(): string {
	return tempHome()
}

/** Runs `traj scenario ...` against one data directory, with optional stdin. */
export function scenario(home: string, argv: readonly string[], stdin?: string): Promise<Captured> {
	return capture(["scenario", ...argv, "--json"], { TRAJ_HOME: home }, undefined, stdin)
}

/** `traj scenario apply <name> --file -`, with the document as JSON text. */
export function applyScenario(
	home: string,
	name: string,
	document: unknown,
	extra: readonly string[] = [],
): Promise<Captured> {
	return capture(
		["scenario", "apply", name, "--file", "-", "--json", ...extra],
		{ TRAJ_HOME: home },
		undefined,
		typeof document === "string" ? document : JSON.stringify(document),
	)
}

/** Writes a document to a temporary file and returns its path. */
export function documentFile(document: unknown): string {
	const file = join(mkdtempSync(join(tmpdir(), "traj-scenario-doc-")), "doc.json")
	writeFileSync(file, typeof document === "string" ? document : JSON.stringify(document))
	return file
}

/** The parsed success result, shaped by the helper the test uses. */
export function resultOf(res: Captured): ReturnType<typeof JSON.parse> {
	return JSON.parse(res.out)
}

/** The row a Scenario write reports. */
export type ScenarioBody = {
	id: string | null
	name: string
	contentHash: string
	forkedFrom: string | null
	version: number
	createdAt: string
	updatedAt: string
	document: Record<string, unknown>
}

export function rowOf(data: ReturnType<typeof JSON.parse>): ScenarioBody {
	return (data as { scenario: ScenarioBody }).scenario
}

/** One Scenario summary in a `list` result. */
export type SummaryBody = { id: string; name: string; version: number; forkedFrom: string | null }

export function summariesOf(data: ReturnType<typeof JSON.parse>): SummaryBody[] {
	return (data as { scenarios: SummaryBody[] }).scenarios
}

/** The parsed error envelope's `error` object. */
export function errorOf(res: Captured): {
	code: string
	exitCode: number
	message: string
	path?: string
	hint?: string
	details?: Record<string, unknown>
} {
	return JSON.parse(res.err).error
}
