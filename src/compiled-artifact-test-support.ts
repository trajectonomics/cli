import { join } from "node:path"
import { ROOT, tempDir } from "./launcher-test-support"

/**
 * The autoload switches the shipped binary is compiled with: without them a `bunfig.toml` or
 * `.env` in the working directory runs code or moves `TRAJ_HOME` (ADR-0039).
 */
export const NO_AUTOLOAD: readonly string[] = [
	"--no-compile-autoload-bunfig",
	"--no-compile-autoload-dotenv",
]

export type Artifact = { bytes: Uint8Array; path: string; version: string }

/** The shipped shape: what a release asset holds, and the version it reports. */
export async function buildArtifact(): Promise<Artifact> {
	const out = join(tempDir("traj-build-"), "traj")
	const build = Bun.spawn(
		[process.execPath, "build", "src/index.ts", "--compile", ...NO_AUTOLOAD, `--outfile=${out}`],
		{ cwd: ROOT, stdout: "pipe", stderr: "pipe" },
	)
	if ((await build.exited) !== 0) {
		throw new Error(`compile failed: ${await new Response(build.stderr).text()}`)
	}
	const bytes = new Uint8Array(await Bun.file(out).arrayBuffer())
	const ran = Bun.spawn([out, "--version"], { stdout: "pipe", stderr: "pipe" })
	const version = (await new Response(ran.stdout).text()).trim()
	if ((await ran.exited) !== 0) throw new Error("compiled binary did not answer --version")
	return { bytes, path: out, version }
}

let compiled: Promise<Artifact> | undefined

/** `buildArtifact` once per test process, for the suites that only need the bytes. */
export function compiledArtifact(): Promise<Artifact> {
	compiled ??= buildArtifact()
	return compiled
}
