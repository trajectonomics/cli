import { describe, expect, it } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import pkg from "../package.json"

async function traj(args: string[], env: Record<string, string> = {}) {
	const proc = Bun.spawn(["bun", "src/index.ts", ...args], {
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

describe("process", () => {
	it("exits 0 and prints the bare version", async () => {
		const res = await traj(["--version"])
		expect(res.code).toBe(0)
		expect(res.out).toBe(`${pkg.version}\n`)
	})

	it("exits with the registry's class and writes the envelope to stderr", async () => {
		const res = await traj(["--nope", "--json"])
		expect(res.code).toBe(2)
		expect(res.out).toBe("")
		expect(JSON.parse(res.err).error.code).toBe("unknown_flag")
	})

	it("exits 2 for a bare group, with the envelope on stderr and nothing on stdout", async () => {
		const env = { TRAJ_HOME: mkdtempSync(join(tmpdir(), "traj-test-")) }
		const res = await traj(["report", "--json"], env)
		expect(res.code).toBe(2)
		expect(res.out).toBe("")
		expect(JSON.parse(res.err)).toEqual({
			error: {
				code: "invalid_input",
				exitCode: 2,
				message: "Missing command: report",
				hint: 'Run "traj help report" to list its commands.',
			},
		})
	})
})
