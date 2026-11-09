import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test"
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import {
	type Artifact,
	assetFor,
	cleanup,
	compiledArtifact,
	digest,
	type Package,
	packageCopy,
	releaseServer,
	runLauncher,
	tempDir,
} from "./launcher-test-support"

afterEach(cleanup)

const encoder = new TextEncoder()

describe("the launcher's download", () => {
	let artifact: Artifact
	let name: string
	let pkg: Package

	beforeAll(async () => {
		artifact = await compiledArtifact()
		name = assetFor(process.platform, process.arch)
	})

	beforeEach(() => {
		pkg = packageCopy()
	})

	/** The installed package's launcher, not the checkout's 0.0.0 one. */
	function launch(args: string[], env: Record<string, string>, options: { preload?: string } = {}) {
		return runLauncher(args, env, { launcher: pkg.launcher, ...options })
	}

	function release(missing = 0) {
		const checksums = `${digest(artifact.bytes)}  ${name}\n`
		return releaseServer(
			{
				[`/v${pkg.version}/checksums.txt`]: encoder.encode(checksums),
				[`/v${pkg.version}/${name}`]: artifact.bytes,
			},
			missing,
		)
	}

	it("installs the asset for its own version and runs it", async () => {
		const server = release()
		const home = tempDir()
		try {
			const ran = await launch(["--version"], {
				TRAJ_HOME: home,
				TRAJ_DOWNLOAD_BASE_URL: server.url,
			})
			expect(ran.code).toBe(0)
			expect(ran.out).toBe(`${artifact.version}\n`)
			expect(ran.err).toContain("about 100 MB")
			expect(ran.err).toContain(join(home, "bin"))
			expect(existsSync(join(home, "bin", `traj-${pkg.version}`))).toBe(true)
		} finally {
			server.stop()
		}
	})

	it("retries a not-found while the release is still being built", async () => {
		const server = release(1)
		const home = tempDir()
		try {
			const ran = await launch(["--version"], {
				TRAJ_HOME: home,
				TRAJ_DOWNLOAD_BASE_URL: server.url,
			})
			expect(ran.code).toBe(0)
			expect(ran.out).toBe(`${artifact.version}\n`)
			expect(ran.err).toContain("retrying")
			expect(server.requests()).toBe(3)
		} finally {
			server.stop()
		}
	})

	it("refuses bytes that do not match the published checksum, and installs nothing", async () => {
		const server = releaseServer({
			[`/v${pkg.version}/checksums.txt`]: encoder.encode(`${"0".repeat(64)}  ${name}\n`),
			[`/v${pkg.version}/${name}`]: artifact.bytes,
		})
		const home = tempDir()
		const bin = join(home, "bin")
		try {
			const ran = await launch(["--version"], {
				TRAJ_HOME: home,
				TRAJ_DOWNLOAD_BASE_URL: server.url,
			})
			expect(ran.code).toBe(1)
			expect(ran.out).toBe("")
			expect(ran.err).toContain(`checksum mismatch for ${name}`)
			expect(existsSync(bin) ? readdirSync(bin) : []).toEqual([])
		} finally {
			server.stop()
		}
	})

	it("runs a warm cache without a request", async () => {
		const home = tempDir()
		mkdirSync(join(home, "bin"), { recursive: true })
		writeFileSync(join(home, "bin", `traj-${pkg.version}`), artifact.bytes, { mode: 0o755 })
		const server = release()
		try {
			const ran = await launch(["--version"], {
				TRAJ_HOME: home,
				TRAJ_DOWNLOAD_BASE_URL: server.url,
			})
			expect(ran.code).toBe(0)
			expect(ran.out).toBe(`${artifact.version}\n`)
			expect(server.requests()).toBe(0)
		} finally {
			server.stop()
		}
	})

	it("refuses a 0.0.0 checkout without a request and names the ways to run it", async () => {
		const checkout = packageCopy("0.0.0")
		const server = release()
		try {
			const ran = await runLauncher(
				["--version"],
				{ TRAJ_HOME: tempDir(), TRAJ_DOWNLOAD_BASE_URL: server.url },
				{ launcher: checkout.launcher },
			)
			expect(ran.code).toBe(1)
			expect(ran.err).toContain("bun run dev")
			expect(ran.err).toContain("TRAJ_BINARY_PATH")
			expect(server.requests()).toBe(0)
		} finally {
			server.stop()
		}
	})

	it("runs the binary TRAJ_BINARY_PATH names without a request", async () => {
		const binaryPath = join(tempDir(), "traj")
		writeFileSync(binaryPath, artifact.bytes, { mode: 0o755 })
		const server = release()
		try {
			const ran = await launch(["--version"], {
				TRAJ_HOME: tempDir(),
				TRAJ_BINARY_PATH: binaryPath,
				TRAJ_DOWNLOAD_BASE_URL: server.url,
			})
			expect(ran.code).toBe(0)
			expect(ran.out).toBe(`${artifact.version}\n`)
			expect(server.requests()).toBe(0)
		} finally {
			server.stop()
		}
	})

	it("refuses a platform with no asset before it makes a request", async () => {
		const preload = join(tempDir(), "preload.js")
		writeFileSync(preload, 'Object.defineProperty(process, "platform", { value: "aix" })\n')
		const server = release()
		try {
			const ran = await launch(
				["--version"],
				{ TRAJ_HOME: tempDir(), TRAJ_DOWNLOAD_BASE_URL: server.url },
				{ preload },
			)
			expect(ran.code).toBe(1)
			expect(ran.err).toContain("traj has no build for aix/")
			expect(ran.err).toContain("Supported: darwin/arm64")
			expect(server.requests()).toBe(0)
		} finally {
			server.stop()
		}
	})
})
