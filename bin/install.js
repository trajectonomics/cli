/** Writes the release binary into the cache, completely or not at all. */
import {
	chmodSync,
	existsSync,
	mkdirSync,
	renameSync,
	rmdirSync,
	rmSync,
	writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { writeProblem } from "./launcher.js"

/** Removes the temp file, then the directory this run created when it is empty. */
function cleanFailedInstall(temp, directory, created) {
	try {
		rmSync(temp, { force: true })
	} catch {
		// The temp file was never written.
	}
	if (!created) return
	try {
		rmdirSync(directory)
	} catch {
		// Another run put a file there first; keep its directory.
	}
}

/** A complete file at the cache path, never a half-written one: same directory, then a rename. */
export function install(bytes, dest) {
	const directory = dirname(dest)
	const created = !existsSync(directory)
	const temp = join(directory, `.traj-${process.pid}-${Date.now()}`)
	try {
		mkdirSync(directory, { recursive: true })
		writeFileSync(temp, bytes, { mode: 0o755 })
		chmodSync(temp, 0o755)
		renameSync(temp, dest)
	} catch (error) {
		// A concurrent run may have won the race with a complete file; use it and drop ours.
		if (existsSync(dest)) return
		// A first run that cannot install leaves no empty bin/ behind for the next run to trust.
		cleanFailedInstall(temp, directory, created)
		throw new Error(writeProblem(error, directory))
	} finally {
		try {
			rmSync(temp, { force: true })
		} catch {
			// The directory was never created, so there is no half-written file to remove.
		}
	}
}
