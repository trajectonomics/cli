import type { Group } from "../../command"
import { defineGroup } from "../../command"
import { remove } from "./remove"

export const data: Group = defineGroup({
	name: "data",
	summary: "Manage the stored data itself",
	children: [remove],
})
