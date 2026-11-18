import { describe, expect, it } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { install } from "../bin/install.js"
import {
	assetName,
	checksumFor,
	exitStatus,
	releaseUrl,
	sha256,
	verifyChecksum,
	writeProblem,
} from "../bin/launcher.js"
import { tempDir } from "./launcher-test-support"

describe("asset naming", () => {
	it("maps every shipped platform and architecture to its release asset", () => {
		expect(assetName("darwin", "arm64")).toBe("traj-darwin-arm64")
		expect(assetName("darwin", "x64")).toBe("traj-darwin-x64")
		expect(assetName("linux", "x64")).toBe("traj-linux-x64")
		expect(assetName("linux", "arm64")).toBe("traj-linux-arm64")
		expect(assetName("win32", "x64")).toBe("traj-windows-x64.exe")
	})

	it("refuses an unsupported platform and names the supported ones", () => {
		expect(() => assetName("linux", "riscv64")).toThrow(/linux\/riscv64/)
		expect(() => assetName("linux", "riscv64")).toThrow(/Supported: darwin\/arm64/)
	})
})

describe("release URL", () => {
	it("points at the asset of the release matching the package version", () => {
		expect(releaseUrl("1.2.3", "traj-linux-x64")).toBe(
			"https://github.com/trajectonomics/cli/releases/download/v1.2.3/traj-linux-x64",
		)
	})

	it("takes a download base override", () => {
		expect(releaseUrl("1.2.3", "checksums.txt", "http://127.0.0.1:9")).toBe(
			"http://127.0.0.1:9/download/v1.2.3/checksums.txt",
		)
	})
})

describe("a child's exit status", () => {
	it("passes a normal exit code through", () => {
		expect(exitStatus(0, null)).toBe(0)
		expect(exitStatus(7, null)).toBe(7)
	})

	it("reports any signal as 128 + its number, not only the forwarded three", () => {
		expect(exitStatus(null, "SIGINT")).toBe(130)
		expect(exitStatus(null, "SIGTERM")).toBe(143)
		expect(exitStatus(null, "SIGKILL")).toBe(137)
		expect(exitStatus(null, "SIGSEGV")).toBe(139)
	})
})

describe("checksums", () => {
	const digest = "a".repeat(64)

	it("reads the digest a checksums file names for an asset", () => {
		expect(
			checksumFor(`${"b".repeat(64)}  other\n${digest}  traj-linux-x64\n`, "traj-linux-x64"),
		).toBe(digest)
	})

	it("reads the binary-mode form sha256sum writes with an asterisk", () => {
		expect(checksumFor(`${digest} *traj-darwin-arm64\n`, "traj-darwin-arm64")).toBe(digest)
	})

	it("refuses an asset the checksums file does not list", () => {
		expect(() => checksumFor(`${digest}  other\n`, "traj-linux-x64")).toThrow(
			/no entry for traj-linux-x64/,
		)
	})

	it("accepts the bytes whose digest it lists", () => {
		const bytes = new TextEncoder().encode("binary")
		expect(verifyChecksum(`${sha256(bytes)}  traj-linux-x64\n`, "traj-linux-x64", bytes)).toBe(
			sha256(bytes),
		)
	})

	it("refuses bytes whose digest differs from the listed one", () => {
		expect(() =>
			verifyChecksum(`${digest}  traj-linux-x64\n`, "traj-linux-x64", new Uint8Array([1])),
		).toThrow(/checksum mismatch for traj-linux-x64/)
	})
})

describe("a failed install", () => {
	it("says a full disk needs about 100 MB in the directory", () => {
		expect(writeProblem({ code: "ENOSPC" }, "/h/.traj/bin")).toBe(
			"disk full: needs about 100 MB in /h/.traj/bin; free space and retry.",
		)
	})

	it("names permission denied and the directory", () => {
		const message = writeProblem({ code: "EACCES" }, "/h/.traj/bin")
		expect(message).toContain("permission denied")
		expect(message).toContain("/h/.traj/bin")
	})

	it("names a path blocked by a file as not a directory", () => {
		const message = writeProblem({ code: "ENOTDIR" }, "/h/.traj/bin")
		expect(message).toContain("not a directory")
		expect(message).toContain("/h/.traj/bin")
	})

	it("keeps the cause's own words when it knows none of them", () => {
		expect(writeProblem(new Error("unknown error, write"), "/h/.traj/bin")).toContain(
			"unknown error, write",
		)
	})
})

describe("install", () => {
	it("removes the bin directory it created when the file cannot be written", () => {
		const directory = join(tempDir(), "bin")
		expect(() => install(new Uint8Array([1]), join(directory, "tr\0aj"))).toThrow()
		expect(existsSync(directory)).toBe(false)
	})
})
