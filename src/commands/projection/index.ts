import type { Group } from "../../command"
import { defineGroup } from "../../command"
import { compare } from "./compare"
import { run } from "./run"

export const projection: Group = defineGroup({
	name: "projection",
	summary: "Project the future under a Scenario, and compare two of them",
	children: [compare, run],
})
