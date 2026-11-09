import { afterAll, describe, expect, it } from "bun:test"
import { join } from "node:path"
import { cleanup, compiledArtifact, ROOT } from "./launcher-test-support"

afterAll(cleanup)

const manifest = (await Bun.file(join(ROOT, "package.json")).json()) as { version: string }

describe("the compiled binary", () => {
	it("reports the package version, which is what makes --version a sentinel", async () => {
		expect((await compiledArtifact()).version).toBe(manifest.version)
	}, 60_000)

	it("writes one error envelope to stderr and nothing to stdout", async () => {
		const proc = Bun.spawn([(await compiledArtifact()).path, "--nope", "--json"], {
			stdout: "pipe",
			stderr: "pipe",
		})
		const [out, err, code] = await Promise.all([
			new Response(proc.stdout).text(),
			new Response(proc.stderr).text(),
			proc.exited,
		])
		expect(code).toBe(2)
		expect(out).toBe("")
		expect((JSON.parse(err) as { error: { code: string } }).error.code).toBe("unknown_flag")
	}, 60_000)
})
