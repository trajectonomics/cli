import { describe, expect, it } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { ROOT } from "./launcher-test-support"

type Manifest = {
	private?: boolean
	version: string
	bin: Record<string, string>
	files: string[]
	dependencies?: Record<string, string>
	devDependencies?: Record<string, string>
	engines?: { node?: string }
	publishConfig?: { access?: string }
}

const manifest = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as Manifest

describe("the publishable manifest", () => {
	it("is not private and publishes publicly, because a scoped package defaults to restricted", () => {
		expect(manifest.private).toBeUndefined()
		expect(manifest.publishConfig?.access).toBe("public")
	})

	it("ships only the launcher; npm adds the README, the licence and the manifest", () => {
		expect(manifest.files).toEqual(["bin/"])
		expect(manifest.files.every((entry) => entry.startsWith("bin/"))).toBe(true)
		expect(existsSync(join(ROOT, "README.md"))).toBe(true)
		expect(existsSync(join(ROOT, "LICENSE"))).toBe(true)
	})

	it("names a bin command that exists", () => {
		expect(manifest.bin["traj"]).toBe("./bin/traj.js")
		expect(existsSync(join(ROOT, manifest.bin["traj"] ?? ""))).toBe(true)
	})

	it("has no runtime dependencies, because both launcher files import only node: and each other", () => {
		expect(manifest.dependencies ?? {}).toEqual({})
		for (const file of ["launcher.js", "traj.js"]) {
			const source = readFileSync(join(ROOT, "bin", file), "utf8")
			for (const [, specifier] of source.matchAll(/from "([^"]+)"/g)) {
				expect(specifier?.startsWith("node:") || specifier?.startsWith("./")).toBe(true)
			}
		}
	})

	it("declares the Node version the launcher needs", () => {
		expect(manifest.engines?.node).toBe(">=20")
	})

	it("cannot reach the TypeScript source or the build output", () => {
		const admitted = (path: string) => manifest.files.some((entry) => path.startsWith(entry))
		expect(admitted("src/index.ts")).toBe(false)
		expect(admitted("dist/traj")).toBe(false)
		expect(admitted("bin/traj.js")).toBe(true)
	})

	it("keeps the build-time-only packages out of the install", () => {
		expect(manifest.devDependencies).toHaveProperty("zod")
		expect(manifest.devDependencies).toHaveProperty("@trajectonomics/ledger")
	})
})
