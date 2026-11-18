import type { ExitCode } from "./registry"
import { RETRYABLE_CODES } from "./registry"
import { table } from "./usage-labels"

/** What each exit class means (ADR-0010), so help and the registry cannot drift apart. */
const EXIT_CLASSES: Readonly<Record<ExitCode, string>> = {
	0: "ok",
	1: "unexpected",
	2: "invalid input",
	3: "domain rejection",
	4: "not found",
	5: "conflict",
}

/** The root help's exit-code block: every class, and exactly which codes a caller may retry. */
export function exitUsage(): string[] {
	const rows = Object.keys(EXIT_CLASSES)
		.map(Number)
		.sort((left, right) => left - right)
		.map((code) => [String(code), EXIT_CLASSES[code as ExitCode]] as const)
	return [
		"",
		"Exit codes:",
		...table(rows),
		"",
		`Retryable codes: ${[...RETRYABLE_CODES].sort().join(", ")}`,
		"Every other failure is permanent.",
	]
}
