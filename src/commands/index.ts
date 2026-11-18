import type { Group } from "../command"
import { defineGroup } from "../command"
import { account } from "./account"
import { backup } from "./backup"
import { balance } from "./balance"
import { baseline } from "./baseline"
import { data } from "./data"
import { doctor } from "./doctor"
import { exportCommand } from "./export"
import { fi } from "./fi"
import { help } from "./help"
import { init } from "./init"
import { inspect } from "./inspect"
import { projection } from "./projection"
import { report } from "./report"
import { restore } from "./restore"
import { scenario } from "./scenario"
import { schema } from "./schema"
import { tx } from "./tx"
import { version } from "./version"

/** The command tree. Add a command here: one entry, one file (or folder, for a group). */
export const root: Group = defineGroup({
	name: "traj",
	summary: "trajectonomics command line",
	children: [
		account,
		backup,
		balance,
		baseline,
		data,
		doctor,
		exportCommand,
		fi,
		help,
		init,
		inspect,
		projection,
		report,
		restore,
		scenario,
		schema,
		tx,
		version,
	],
})
