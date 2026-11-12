import { afterEach, describe, expect, it } from "bun:test"
import { chmodSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { cleanup, LAUNCHER, runLauncher, tempDir } from "./launcher-test-support"

afterEach(cleanup)

function script(body: string): string {
	const path = join(tempDir(), "binary.sh")
	writeFileSync(path, `#!/bin/sh\n${body}\n`)
	chmodSync(path, 0o755)
	return path
}

function run(binaryPath: string): Bun.Subprocess<"ignore", "pipe", "pipe"> {
	return Bun.spawn([process.execPath, LAUNCHER, "--version"], {
		env: { PATH: process.env["PATH"] ?? "", TRAJ_HOME: tempDir(), TRAJ_BINARY_PATH: binaryPath },
		stdout: "pipe",
		stderr: "pipe",
	})
}

describe("the launcher as a parent process", () => {
	it("reports a binary it cannot start as one plain line, not a stack trace", async () => {
		const missing = join(tempDir(), "not-there")
		const ran = await runLauncher(["--version"], {
			TRAJ_HOME: tempDir(),
			TRAJ_BINARY_PATH: missing,
		})
		expect(ran.code).toBe(1)
		expect(ran.err).toContain(`traj: cannot run ${missing}`)
		expect(ran.err).not.toContain("Error:")
	})

	it("forwards the binary's exit status", async () => {
		expect(await run(script("exit 7")).exited).toBe(7)
	})
})

describe.skipIf(process.platform === "win32")("the launcher as a parent process", () => {
	it("exits 128 + signal when the binary it runs is signalled", async () => {
		const proc = run(script("exec sleep 30"))
		await Bun.sleep(500)
		proc.kill("SIGINT")
		expect(await proc.exited).toBe(130)
	}, 15_000)
})
