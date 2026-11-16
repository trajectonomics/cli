import type { Group, Leaf, Node } from "./command"
import { type AppError, fail } from "./errors"

export const HELP_HINT = 'Run "traj help" to list commands.'

/** Nodes in a stable order, so every listing is deterministic. */
export function sortedByName<T extends Node>(nodes: readonly T[]): T[] {
	return [...nodes].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
}

/** Where a command line landed: the node it names, and the arguments left for that node. */
export type Walk = { node: Node; path: string[]; rest: string[] }

/** The recovery hint for a path that still needs a command under it: `traj help <path>`. */
function listCommandsHint(path: readonly string[]): string {
	return path.length === 0 ? HELP_HINT : `Run "traj help ${path.join(" ")}" to list its commands.`
}

export function unknownCommand(path: string[], word: string): AppError {
	return fail("unknown_command", {
		message: `Unknown command: ${[...path, word].join(" ")}`,
		hint: listCommandsHint(path),
	})
}

/** A group below the root named with no command under it: the command line is incomplete. */
export function missingCommand(path: readonly string[]): AppError {
	return fail("invalid_input", {
		message: `Missing command: ${path.join(" ")}`,
		hint: listCommandsHint(path),
	})
}

/**
 * Consumes leading words down the tree. Words are subcommand names only while the current node
 * is a group; once a leaf is reached, every remaining token is that leaf's own arguments.
 */
export function walk(root: Group, argv: readonly string[]): Walk | AppError {
	let node: Node = root
	const path: string[] = []
	const rest: string[] = []
	for (const [index, token] of argv.entries()) {
		if (token === "--") return { node, path, rest: [...rest, ...argv.slice(index)] }
		if (node.kind !== "group" || token.startsWith("-")) {
			rest.push(token)
			continue
		}
		const child: Node | undefined = node.children.find((candidate) => candidate.name === token)
		if (!child) return unknownCommand(path, token)
		node = child
		path.push(token)
	}
	return { node, path, rest }
}

export function findNode(root: Group, path: readonly string[]): Node | undefined {
	let node: Node = root
	for (const word of path) {
		if (node.kind !== "group") return undefined
		const child: Node | undefined = node.children.find((candidate) => candidate.name === word)
		if (!child) return undefined
		node = child
	}
	return node
}

export type PlacedLeaf = { path: string[]; leaf: Leaf }

/** Every leaf under a node, with its full path, in name order. */
export function leavesOf(node: Node, path: string[] = []): PlacedLeaf[] {
	if (node.kind === "leaf") return [{ path, leaf: node }]
	return sortedByName(node.children).flatMap((child) => leavesOf(child, [...path, child.name]))
}
