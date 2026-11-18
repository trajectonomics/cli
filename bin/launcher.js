/** Platform to release asset, checksums and release URLs. Plain JavaScript and `node:` only. */
import { createHash } from "node:crypto"
import { constants } from "node:os"

/** The repo's releases root: one release's assets sit under `download/v<version>`. */
export const RELEASE_BASE = "https://github.com/trajectonomics/cli/releases"

/** `process.platform`-`process.arch` to asset name. */
const ASSETS = {
	"darwin-arm64": "traj-darwin-arm64",
	"darwin-x64": "traj-darwin-x64",
	"linux-x64": "traj-linux-x64",
	"linux-arm64": "traj-linux-arm64",
	"win32-x64": "traj-windows-x64.exe",
}

/** The `platform/arch` pairs a release has a binary for, in message order. */
export const SUPPORTED = Object.keys(ASSETS).map((key) => key.replace("-", "/"))

/** The one asset a release has for this platform and architecture. */
export function assetName(platform, arch) {
	const asset = ASSETS[`${platform}-${arch}`]
	if (asset === undefined) {
		throw new Error(
			`traj has no build for ${platform}/${arch}. Supported: ${SUPPORTED.join(", ")}.`,
		)
	}
	return asset
}

/** `"<sha256>  <name>"` per line, as the release job writes it. */
export function checksumFor(checksums, name) {
	for (const line of checksums.split("\n")) {
		const [digest, listed] = line.trim().split(/\s+/)
		if (listed === name || listed === `*${name}`) return String(digest).toLowerCase()
	}
	throw new Error(`checksums.txt has no entry for ${name}.`)
}

export function sha256(bytes) {
	return createHash("sha256").update(bytes).digest("hex")
}

/** The listed digest, after proving it is the digest of these bytes. */
export function verifyChecksum(checksums, name, bytes) {
	const listed = checksumFor(checksums, name)
	const actual = sha256(bytes)
	if (actual !== listed) {
		throw new Error(`checksum mismatch for ${name}: expected ${listed}, got ${actual}`)
	}
	return actual
}

/**
 * What a shell reports for a signalled child: `128 + signal`. A normal exit passes
 * its own code through.
 */
export function exitStatus(code, signal) {
	return signal === null ? (code ?? 1) : 128 + (constants.signals[signal] ?? 0)
}

export function releaseUrl(version, name, base = RELEASE_BASE) {
	return `${base}/download/v${version}/${name}`
}

/**
 * A failed write in plain words: the cause, the directory, and the next step. Node reports a
 * full disk as a bare "UNKNOWN: unknown error, write", so a known code carries the sentence.
 */
export function writeProblem(error, directory) {
	const code = error !== null && typeof error === "object" ? error.code : undefined
	if (code === "ENOSPC" || code === "EDQUOT") {
		return `disk full: needs about 100 MB in ${directory}; free space and retry.`
	}
	if (code === "EACCES" || code === "EPERM" || code === "EROFS") {
		return `permission denied writing ${directory}; check its permissions or set TRAJ_HOME.`
	}
	if (code === "EEXIST" || code === "ENOTDIR" || code === "EISDIR") {
		return `${directory} is not a directory; move the file or set TRAJ_HOME to a directory.`
	}
	return error instanceof Error ? error.message : String(error)
}
