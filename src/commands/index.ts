import type { Group } from "../command"
import { defineGroup } from "../command"
import { account } from "./account"
import { help } from "./help"
import { init } from "./init"
import { schema } from "./schema"
import { version } from "./version"

/** The command tree. Add a command here: one entry, one file (or folder, for a group). */
export const root: Group = defineGroup({
	name: "traj",
	summary: "trajectonomics command line",
	children: [account, help, init, schema, version],
})
