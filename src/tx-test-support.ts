import { expect } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { type Captured, capture } from "./test-support"

export const UUID_V7: RegExp =
	/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** A data directory that does not exist yet, inside a fresh temporary folder. */
export function tempHome(): string {
	return join(mkdtempSync(join(tmpdir(), "traj-tx-")), "home")
}

export type Traj = (argv: string[]) => Promise<Captured>

export function cli(home: string, stdin?: string): Traj {
	return (argv) => capture(argv, { TRAJ_HOME: home }, undefined, stdin)
}

export type Account = { id: string; name: string }

export async function account(traj: Traj, name: string, type = "asset"): Promise<Account> {
	const res = await traj(["--json", "account", "add", name, "--type", type, "--currency", "THB"])
	expect(res.code).toBe(0)
	return JSON.parse(res.out).account as Account
}

/** Adds each `[name, type]` pair in order and returns them keyed by name. */
export async function accounts(
	traj: Traj,
	names: readonly (readonly [string, string])[],
): Promise<Record<string, Account>> {
	const added: Record<string, Account> = {}
	for (const [name, type] of names) added[name] = await account(traj, name, type)
	return added
}
