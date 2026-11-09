import { createHash } from "node:crypto"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const ROOT: string = join(import.meta.dir, "..")
export const LAUNCHER: string = join(ROOT, "bin", "traj.js")

/** Not a real release: a version the tests drive the launcher with. */
export const RELEASE_VERSION = "9.9.9"

const created: string[] = []

/** A temporary directory the caller fills; `cleanup` removes every one. */
export function tempDir(prefix = "traj-"): string {
	const dir = mkdtempSync(join(tmpdir(), prefix))
	created.push(dir)
	return dir
}

export function cleanup(): void {
	for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true })
}

export type Package = { launcher: string; version: string }

/** The layout npm installs: `bin/` plus a package.json whose version a release stamped. */
export function packageCopy(version: string = RELEASE_VERSION): Package {
	const dir = tempDir("traj-pkg-")
	mkdirSync(join(dir, "bin"), { recursive: true })
	for (const file of ["launcher.js", "traj.js"]) {
		copyFileSync(join(ROOT, "bin", file), join(dir, "bin", file))
	}
	writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "@trajectonomics/cli", version }))
	return { launcher: join(dir, "bin", "traj.js"), version }
}

export type Ran = { code: number; out: string; err: string }

/** Runs the launcher at the process seam, the way `npx` and `bunx` do. */
export async function runLauncher(
	args: string[],
	env: Record<string, string>,
	options: { launcher?: string; preload?: string } = {},
): Promise<Ran> {
	const preload = options.preload === undefined ? [] : ["--preload", options.preload]
	const proc = Bun.spawn([process.execPath, ...preload, options.launcher ?? LAUNCHER, ...args], {
		env: { PATH: process.env["PATH"] ?? "", ...env },
		stdout: "pipe",
		stderr: "pipe",
	})
	const [out, err, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	])
	return { code, out, err }
}

export function digest(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex")
}

export type ReleaseServer = { url: string; requests: () => number; stop: () => void }

/** Serves release assets by path; `missing` 404s that many requests first. */
export function releaseServer(files: Record<string, Uint8Array>, missing = 0): ReleaseServer {
	let served = 0
	let misses = missing
	const server = Bun.serve({
		port: 0,
		fetch(request) {
			served++
			if (misses > 0) {
				misses--
				return new Response("not found", { status: 404 })
			}
			const body = files[new URL(request.url).pathname]
			return body === undefined ? new Response("not found", { status: 404 }) : new Response(body)
		},
	})
	return {
		url: `http://127.0.0.1:${server.port}`,
		requests: () => served,
		stop: () => void server.stop(true),
	}
}

/** The asset name a release uses for this platform, as a test fixture names it. */
export function assetFor(platform: string, arch: string): string {
	const exe = platform === "win32" ? ".exe" : ""
	if (!["darwin", "linux", "win32"].includes(platform)) throw new Error(platform)
	return `traj-${platform}-${arch}${exe}`
}

export type Artifact = { bytes: Uint8Array; path: string; version: string }

let compiled: Promise<Artifact> | undefined

/** The shipped shape, compiled once, and the version it reports: what a release asset holds. */
export function compiledArtifact(): Promise<Artifact> {
	compiled ??= (async () => {
		const out = join(tempDir("traj-build-"), "traj")
		const build = Bun.spawn(
			[process.execPath, "build", "src/index.ts", "--compile", `--outfile=${out}`],
			{ cwd: ROOT, stdout: "pipe", stderr: "pipe" },
		)
		if ((await build.exited) !== 0) {
			throw new Error(`compile failed: ${await new Response(build.stderr).text()}`)
		}
		const bytes = new Uint8Array(await Bun.file(out).arrayBuffer())
		const ran = Bun.spawn([out, "--version"], { stdout: "pipe", stderr: "pipe" })
		const version = (await new Response(ran.stdout).text()).trim()
		if ((await ran.exited) !== 0) throw new Error(`compiled binary did not answer --version`)
		return { bytes, path: out, version }
	})()
	return compiled
}
