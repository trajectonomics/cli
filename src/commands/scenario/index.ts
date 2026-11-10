import type { Group } from "../../command"
import { defineGroup } from "../../command"
import { apply } from "./apply"
import { diff } from "./diff"
import { fork } from "./fork"
import { list } from "./list"
import { rm } from "./rm"
import { show } from "./show"

export const scenario: Group = defineGroup({
	name: "scenario",
	summary: "Manage Scenarios, the named what-ifs",
	children: [apply, diff, fork, list, rm, show],
})
