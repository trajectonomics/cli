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

// Setup and result shapes for the `tx amend` tests.

export type Written = {
	id: string
	date: string
	memo: string | null
	linkedTo: string | null
	externalRef: string | null
	postings: {
		ordinal: number
		accountId: string
		amount: string
		currency: string
		dimensions: Record<string, string> | null
	}[]
}

export type Amended = {
	dryRun: boolean
	status: "amended" | "already_corrected"
	reversal: Written | null
	replacement: Written | null
	correction: Written | null
}

export const json = (res: { out: string }): Amended => JSON.parse(res.out) as Amended

/** A fresh CLI over a temp home holding Cash and Food, and the lunch it records. */
export async function lunch(
	traj: Traj,
	externalRef?: string,
): Promise<{ opened: Record<string, Account>; original: Written }> {
	const opened = await accounts(traj, [
		["Cash", "asset"],
		["Food", "expense"],
	])
	const ref = externalRef === undefined ? [] : ["--external-ref", externalRef]
	const added = await traj([
		"tx",
		"add",
		"--from",
		"Cash",
		"--to",
		"Food",
		"--amount",
		"120.50",
		"--date",
		"2026-03-01",
		...ref,
		"--json",
	])
	expect(added.code).toBe(0)
	return { opened, original: JSON.parse(added.out).transaction as Written }
}

/** Amends the lunch with a 100.00 replacement dated 2026-03-02, unless `extra` says otherwise. */
export function amend(traj: Traj, id: string, extra: readonly string[] = []): Promise<Captured> {
	return traj([
		"tx",
		"amend",
		id,
		"--from",
		"Cash",
		"--to",
		"Food",
		"--amount",
		"100",
		"--date",
		"2026-03-02",
		...extra,
		"--json",
	])
}

/** How many transaction rows and posting rows the ledger holds. */
export async function ledgerSize(traj: Traj): Promise<{ transactions: number; postings: number }> {
	const listed = JSON.parse((await traj(["tx", "list", "--json"])).out) as {
		transactions: { postings: unknown[] }[]
	}
	const postings = listed.transactions.reduce((total, tx) => total + tx.postings.length, 0)
	return { transactions: listed.transactions.length, postings }
}
