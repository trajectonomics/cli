import { homedir } from "node:os"
import { join } from "node:path"
import type { Env } from "./command"

/** The one database file inside the data directory, which every command that opens or removes it names. */
export const DATABASE_FILE = "traj.db"

/** `TRAJ_HOME` if set, otherwise `~/.traj`, resolved through `os.homedir()` on every platform. */
export function dataDirectory(env: Env): string {
	const override = env["TRAJ_HOME"]
	return override ? override : join(homedir(), ".traj")
}
