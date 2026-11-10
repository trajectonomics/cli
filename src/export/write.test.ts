import { describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { outPath } from "./testing"
import { writeExport } from "./write"

describe("writeExport", () => {
	it("removes the directory it created when a later write fails", async () => {
		const out = outPath()
		// A name no filesystem accepts fails the second write, after the directory exists.
		const failure = await writeExport(out, [
			{ name: "traj.jsonl", contents: "header\n" },
			{ name: "x".repeat(300), contents: "x" },
		])
		expect(failure?.body).toMatchObject({
			code: "export_failed",
			exitCode: 1,
			path: "out",
			details: { path: out, code: "ENAMETOOLONG" },
		})
		expect(failure?.body.message).toContain(out)
		expect(failure?.body.hint).toContain("Nothing was written")
		expect(existsSync(out)).toBe(false)
	})
})
