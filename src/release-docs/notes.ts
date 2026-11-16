import type { Group, Node } from "../command"
import type { HelpNote } from "./types"

function walk(node: Node, path: readonly string[], notes: HelpNote[]): void {
	const here = [...path, node.name]
	if (node.note !== undefined) notes.push({ command: here.join(" "), note: node.note })
	if (node.kind !== "group") return
	for (const child of node.children) walk(child, here, notes)
}

/** Every release note in a command tree, in path order, for the freshness rule. */
export function helpNotes(root: Group): HelpNote[] {
	const notes: HelpNote[] = []
	for (const child of root.children) walk(child, [], notes)
	return notes.sort((a, b) => (a.command < b.command ? -1 : a.command > b.command ? 1 : 0))
}
