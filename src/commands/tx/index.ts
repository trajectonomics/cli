import type { Group } from "../../command"
import { defineGroup } from "../../command"
import { add } from "./add"
import { list } from "./list"
import { show } from "./show"
import { voidTx } from "./void"

export const tx: Group = defineGroup({
	name: "tx",
	summary: "Manage ledger transactions",
	children: [add, list, show, voidTx],
})
