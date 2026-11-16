import type { Group } from "../../command"
import { defineGroup } from "../../command"
import { show } from "./show"

export const baseline: Group = defineGroup({
	name: "baseline",
	summary: "Show the Baseline a Projection starts from",
	note: "Projection ships in 0.2.0.",
	children: [show],
})
