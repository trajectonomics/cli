/**
 * Helpers for a committed golden: its exact bytes, the one serialization every golden uses, and
 * the deliberate re-baseline switch. A golden belongs to the module that owns it, so the folder
 * is the caller's.
 */
export function goldenTextIn(base: URL, name: string): Promise<string> {
	return Bun.file(new URL(name, base)).text()
}

/** The one serialization goldens use: tab indents and one trailing newline. */
export function goldenJson(value: unknown): string {
	return `${JSON.stringify(value, null, "\t")}\n`
}

/**
 * Rewrites a golden when `TRAJ_UPDATE_GOLDEN=1` asks for a deliberate re-baseline; otherwise it
 * writes nothing, so a diff is the only thing an ordinary test run can produce.
 */
export async function recordGoldenIn(base: URL, name: string, value: unknown): Promise<void> {
	if (process.env["TRAJ_UPDATE_GOLDEN"] === "1") {
		await Bun.write(new URL(name, base), goldenJson(value))
	}
}
