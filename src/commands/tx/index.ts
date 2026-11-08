import type { Group } from "../../command"
import { defineGroup } from "../../command"
import { add } from "./add"

export const tx: Group = defineGroup({
	name: "tx",
	summary: "Manage ledger transactions",
	children: [add],
})
