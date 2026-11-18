import { afterAll, beforeAll, describe, expect, it } from "bun:test"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { type Artifact, buildArtifact, NO_AUTOLOAD } from "./compiled-artifact-test-support"
import { cleanup, ROOT, tempDir } from "./launcher-test-support"

afterAll(cleanup)

const manifest = (await Bun.file(join(ROOT, "package.json")).json()) as { version: string }

describe("the compiled binary", () => {
	let artifact: Artifact

	// Its own build: another suite's cleanup removes whatever it compiled.
	beforeAll(async () => {
		artifact = await buildArtifact()
	})

	it("reports the package version, which is what makes --version a sentinel", async () => {
		expect(artifact.version).toBe(manifest.version)
	}, 60_000)

	it("writes one error envelope to stderr and nothing to stdout", async () => {
		const proc = Bun.spawn([artifact.path, "--nope", "--json"], {
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

	it("runs nothing a working directory's bunfig.toml preloads", async () => {
		const cwd = tempDir("traj-cwd-")
		writeFileSync(join(cwd, "bunfig.toml"), 'preload = ["./pre.js"]\n')
		writeFileSync(join(cwd, "pre.js"), 'require("node:fs").writeFileSync("marker", "ran")\n')
		const proc = Bun.spawn([artifact.path, "--version"], {
			cwd,
			stdout: "pipe",
			stderr: "pipe",
		})
		const [out, code] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
		expect(code).toBe(0)
		expect(out.trim()).toBe(manifest.version)
		expect(existsSync(join(cwd, "marker"))).toBe(false)
	}, 60_000)

	it("is compiled with Bun's autoload off wherever a release builds it", () => {
		// The two tests above only hold because every compile keeps the switch off. A workflow or
		// a `bun run build` that drops it puts a working directory back in charge (ADR-0039).
		const workflows = ["binaries.yml", "installer-smoke.yml"].map((name) =>
			readFileSync(join(ROOT, ".github/workflows", name), "utf8"),
		)
		const builds = [...workflows, readFileSync(join(ROOT, "package.json"), "utf8")].flatMap(
			(text) => text.split("\n").filter((line) => line.includes("bun build")),
		)
		expect(builds).toHaveLength(7)
		const required = [...NO_AUTOLOAD, "--compile"]
		for (const line of builds) expect(required.filter((flag) => !line.includes(flag))).toEqual([])
	})

	it("loads no .env from the working directory", async () => {
		const cwd = tempDir("traj-cwd-")
		writeFileSync(join(cwd, ".env"), "TRAJ_FORMAT=json\n")
		const proc = Bun.spawn([artifact.path, "--nope"], {
			cwd,
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
		// Text, not the JSON envelope `TRAJ_FORMAT=json` would have asked for.
		expect(err).toContain("unknown_flag")
		expect(err).not.toContain('{"error"')
	}, 60_000)
})
