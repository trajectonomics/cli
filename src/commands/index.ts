import type { Group } from "../command"
import { defineGroup } from "../command"
import { account } from "./account"
import { balance } from "./balance"
import { exportCommand } from "./export"
import { help } from "./help"
import { init } from "./init"
import { inspect } from "./inspect"
import { scenario } from "./scenario"
import { schema } from "./schema"
import { tx } from "./tx"
import { version } from "./version"

/** The command tree. Add a command here: one entry, one file (or folder, for a group). */
export const root: Group = defineGroup({
	name: "traj",
	summary: "trajectonomics command line",
import { balance } from "./balance"
import { exportCommand } from "./export"
})
