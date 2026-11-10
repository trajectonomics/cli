import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { tempHome } from "../store/testing"
import { capture } from "../test-support"

/** A directory path that does not exist yet, so the command is the one that creates it. */
export function outPath(): string {
	return join(mkdtempSync(join(tmpdir(), "traj-export-")), "out")
}

/** The seeded entity is the only row on a fresh database; every other table is empty. */
export function account(name: string, type: string, home: string): Promise<unknown> {
	return capture(["account", "add", name, "--type", type, "--currency", "THB"], {
		TRAJ_HOME: home,
	})
}

/** Adds one transaction through the document form, so the memo can hold any text. */
export async function memoTransaction(
	home: string,
	memo: string | undefined,
	date: string,
	ref: string,
): Promise<void> {
	const document = JSON.stringify({
		date,
		externalRef: ref,
		...(memo === undefined ? {} : { memo }),
		postings: [
			{ account: "Food", amount: "10.00", currency: "THB" },
			{ account: "Cash", amount: "-10.00", currency: "THB" },
		],
	})
	const res = await capture(
		["tx", "add", "--postings", "-", "--json"],
		{ TRAJ_HOME: home },
		undefined,
		document,
	)
	if (res.code !== 0) throw new Error(res.err)
}

/**
 * A home with the cells the human copies must not mangle: a comma, a double quote and a newline
 * in one memo, a markup-and-pipe memo beside it, and an empty memo beside a missing one.
 */
export async function edgeHome(): Promise<string> {
	const home = tempHome()
	await account("Cash", "asset", home)
	await account("Food", "expense", home)
	await memoTransaction(home, 'comma, quote " and\nnewline', "2026-03-01", "edge:1")
	await memoTransaction(home, "pipe | back\\slash <tag> & amp", "2026-03-02", "edge:2")
	await memoTransaction(home, "", "2026-03-03", "edge:3")
	await memoTransaction(home, undefined, "2026-03-04", "edge:4")
	return home
}

/**
 * Reads RFC 4180 CSV text into rows of cells. A small reader of the format itself, so the test
 * checks the bytes a spreadsheet would read rather than the bytes the writer hoped for. Every
 * record ends in CRLF, as the writer guarantees, so a cell is always terminated by `,` or CRLF.
 */
const CELL = /(?:"((?:[^"]|"")*)"|([^,\r\n]*))(,|\r\n)/y

export function parseCsv(text: string): string[][] {
	const rows: string[][] = []
	let row: string[] = []
	let index = 0
	while (index < text.length) {
		CELL.lastIndex = index
		const match = CELL.exec(text)
		if (match === null) throw new Error(`not RFC 4180 CSV at ${index}`)
		// A quoted cell keeps its commas, quotes and newlines; its doubled quotes become one.
		row.push(match[1] === undefined ? (match[2] ?? "") : match[1].replaceAll('""', '"'))
		if (match[3] !== ",") {
			rows.push(row)
			row = []
		}
		index = CELL.lastIndex
	}
	return rows
}
