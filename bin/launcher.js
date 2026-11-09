/** Platform to release asset, checksums and release URLs. Plain JavaScript and `node:` only. */
import { createHash } from "node:crypto"

/** Where one release's assets live, before `v<version>`. */
export const RELEASE_BASE = "https://github.com/trajectonomics/cli/releases/download"

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

export function releaseUrl(version, name, base = RELEASE_BASE) {
	return `${base}/v${version}/${name}`
}
