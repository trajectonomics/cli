#!/usr/bin/env node
/** The npm package's command: install the release binary for this package's version, then run it. */
import { spawn } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"
import { install } from "./install.js"
import { assetName, exitStatus, releaseUrl, verifyChecksum } from "./launcher.js"

const RETRY_MS = 5 * 60 * 1000
const MAX_WAIT_MS = 30 * 1000
const FORWARDED = ["SIGHUP", "SIGINT", "SIGTERM"]

const { version } = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))

/** A launcher failure is one plain line on stderr and exit 1, never a JSON envelope. */
function fail(message) {
	process.stderr.write(`traj: ${message}\n`)
	process.exitCode = 1
}

function run(binary, args) {
	const child = spawn(binary, args, { stdio: "inherit" })
	child.on("error", (error) => fail(`cannot run ${binary}: ${error.message}`))
	for (const signal of FORWARDED) process.on(signal, () => child.kill(signal))
	child.on("exit", (code, signal) => {
		process.exitCode = exitStatus(code, signal)
	})
}

/** One asset's bytes; only a 404 retries, because npm publishes minutes before the assets land. */
async function download(url) {
	const deadline = Date.now() + RETRY_MS
	let said = false
	for (let wait = 1000; ; wait = Math.min(wait * 2, MAX_WAIT_MS)) {
		const res = await fetch(url)
		if (res.ok) return new Uint8Array(await res.arrayBuffer())
		if (res.status !== 404) throw new Error(`${url} answered ${res.status}`)
		if (Date.now() + wait > deadline) {
			throw new Error(`${url} is not there yet; the release may still be building. Retry shortly.`)
		}
		if (!said) {
			said = true
			process.stderr.write(`traj: ${url} is not there yet; retrying for up to five minutes.\n`)
		}
		await sleep(wait)
	}
}

async function main(args) {
	const chosen = process.env["TRAJ_BINARY_PATH"]
	if (chosen !== undefined) return run(chosen, args)
	if (version === "" || version === "0.0.0") {
		return fail("this is a checkout, not a release: run `bun run dev --` or set TRAJ_BINARY_PATH.")
	}
	const name = assetName(process.platform, process.arch)
	const home = process.env["TRAJ_HOME"] || join(homedir(), ".traj")
	const exe = process.platform === "win32" ? ".exe" : ""
	const dest = join(home, "bin", `traj-${version}${exe}`)
	if (!existsSync(dest)) {
		const base = process.env["TRAJ_DOWNLOAD_BASE_URL"] || undefined
		process.stderr.write(`traj: downloading ${name} v${version} to ${dest} (about 100 MB).\n`)
		const checksums = new TextDecoder().decode(
			await download(releaseUrl(version, "checksums.txt", base)),
		)
		const bytes = await download(releaseUrl(version, name, base))
		verifyChecksum(checksums, name, bytes)
		install(bytes, dest)
	}
	run(dest, args)
}

await main(process.argv.slice(2)).catch((error) => {
	fail(error instanceof Error ? error.message : String(error))
})
