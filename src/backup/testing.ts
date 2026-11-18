import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/** A backup path that does not exist yet, so the command under test is the one that creates it. */
export function backupPath(): string {
	return join(mkdtempSync(join(tmpdir(), "traj-backup-")), "backup")
}
