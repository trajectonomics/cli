import { describe, expect, it } from "bun:test"
import pkg from "../package.json"
import { capture } from "./test-support"

describe("usage and version", () => {
	it("prints usage with no arguments", async () => {
		const res = await capture([])
		expect(res.code).toBe(0)
		expect(res.out).toContain("Usage: traj")
	})

	it("prints usage for the help command and for --help", async () => {
		for (const argv of [["help"], ["--help"]]) {
			const res = await capture(argv)
			expect(res.code).toBe(0)
			expect(res.out).toContain("Usage: traj")
		}
	})

	it("keeps every explicit door to a group's usage at exit 0", async () => {
		for (const argv of [
			["help", "report"],
			["report", "--help"],
			["schema", "report"],
		]) {
			const res = await capture(argv)
			expect(res.code).toBe(0)
			expect(res.out).toContain("report")
			expect(res.err).toBe("")
		}
	})

	it("prints the bare version for --version and the version command", async () => {
		for (const argv of [["--version"], ["version"]]) {
			const res = await capture(argv)
			expect(res.code).toBe(0)
			expect(res.out).toBe(pkg.version)
		}
	})
})

describe("errors", () => {
	it("rejects an unknown command as invalid input, in text on stderr", async () => {
		const res = await capture(["nope"])
		expect(res.code).toBe(2)
		expect(res.out).toBe("")
		expect(res.err).toContain("unknown_command")
		expect(res.err).toContain("Unknown command: nope")
	})
})

describe("strict parsing and format selection", () => {
	it("rejects an unknown flag with unknown_flag", async () => {
		const res = await capture(["--nope"])
		expect(res.code).toBe(2)
		expect(res.out).toBe("")
		expect(res.err).toContain("unknown_flag")
		expect(res.err).toContain("--nope")
	})

	it("answers a malformed command line in JSON when --json is present", async () => {
		const res = await capture(["--nope", "--json"])
		expect(res.code).toBe(2)
		expect(res.out).toBe("")
		const envelope = JSON.parse(res.err)
		expect(envelope.error.code).toBe("unknown_flag")
		expect(envelope.error.exitCode).toBe(2)
		expect(typeof envelope.error.message).toBe("string")
	})

	it("writes JSON errors to stderr only, for an unknown command", async () => {
		const res = await capture(["nope", "--json"])
		expect(res.out).toBe("")
		expect(JSON.parse(res.err).error.code).toBe("unknown_command")
	})

	it("selects JSON from TRAJ_FORMAT alone", async () => {
		const res = await capture(["nope"], { TRAJ_FORMAT: "json" })
		expect(JSON.parse(res.err).error.code).toBe("unknown_command")
	})

	it("lets --json win over TRAJ_FORMAT", async () => {
		const res = await capture(["nope", "--json"], { TRAJ_FORMAT: "human" })
		expect(JSON.parse(res.err).error.code).toBe("unknown_command")
	})

	it("reports an unknown TRAJ_FORMAT as text with exit 2", async () => {
		const res = await capture(["version"], { TRAJ_FORMAT: "yaml" })
		expect(res.code).toBe(2)
		expect(res.out).toBe("")
		expect(res.err).toContain("unknown_format")
		expect(res.err.startsWith("{")).toBe(false)
	})

	it("rejects extra positional arguments as invalid input", async () => {
		const res = await capture(["version", "extra", "--json"])
		expect(res.code).toBe(2)
		expect(JSON.parse(res.err).error.code).toBe("invalid_input")
	})

	it("prints JSON results to stdout in JSON mode", async () => {
		const res = await capture(["version", "--json"])
		expect(res.code).toBe(0)
		expect(JSON.parse(res.out)).toBe(pkg.version)
		expect(res.err).toBe("")
	})
})
