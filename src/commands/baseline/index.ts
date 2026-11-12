import type { Group } from "../../command"
import { defineGroup } from "../../command"
import { show } from "./show"

export const baseline: Group = defineGroup({
	name: "baseline",
	summary: "Show the Baseline a Projection starts from",
	children: [show],
})
