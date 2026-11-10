import { writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { type Account, accounts, type Traj, type Written } from "./tx-test-support"

export type { Account, Traj } from "./tx-test-support"
export { accounts, cli, ledgerSize, tempHome } from "./tx-test-support"

export const HEADER = "date,from,to,amount,memo,external_ref,project"

/** A written row as the import reports it: a dry run states a minted id as null. */
export type ImportWritten = Omit<Written, "id"> & { id: string | null }

export type Imported = {
	dryRun: boolean
	file: string
	rows: {
		line: number
		status: "added" | "duplicate"
		externalRef: string
		transaction: ImportWritten
	}[]
	counts: { added: number; duplicate: number; rejected: number }
}

export type Rejected = {
	line: number
	externalRef: string | null
	status: "rejected"
	reason: {
		code: string
		exitCode: number
		message: string
		path?: string
		hint?: string
		details?: unknown
	}
}

/** A CSV file beside the data directory, so a test run leaves the home alone. */
export function csv(home: string, name: string, lines: readonly string[]): string {
	const path = join(dirname(home), name)
	writeFileSync(path, lines.join("\n"))
	return path
}

export const imported = (res: { out: string }): Imported => JSON.parse(res.out) as Imported

/** A CSV row's cells, joined in the template's column order. */
export function row(cells: readonly string[]): string {
	return cells.join(",")
}

export function errorOf(res: { err: string; out: string }) {
	return JSON.parse(res.err).error as {
		code: string
		exitCode: number
		message: string
		path?: string
		hint?: string
		details: { rows: Rejected[] }
	}
}

export async function seeded(traj: Traj): Promise<Record<string, Account>> {
	return accounts(traj, [
		["Cash", "asset"],
		["Food", "expense"],
		["Salary", "equity"],
	])
}
