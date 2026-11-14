import { Database } from "bun:sqlite"
import { join } from "node:path"
import type { Baseline } from "@trajectonomics/sim"
import { goldenJson, goldenTextIn, recordGoldenIn } from "../golden-test-support"
import { FIXTURE_ACCOUNTS, FIXTURE_AS_OF, FIXTURE_ROWS } from "../ledger-fixture"
import { posting, transaction } from "../ledger-fixture/rows"
import type { PostingRow, RestoreRows, TxRow } from "../store"
import { parseMinorUnits } from "../store"
import { type Captured, capture } from "../test-support"
import type { SimKind } from "./kind"

/** Runs `traj ...` against one data directory. */
export function cli(home: string): (argv: string[]) => Promise<Captured> {
	return (argv: string[]) => capture(argv, { TRAJ_HOME: home })
}

/** `traj baseline show --as-of <the fixture's As-of>` in JSON. */
export function show(home: string, ...args: string[]): Promise<Captured> {
	return cli(home)(["baseline", "show", "--as-of", FIXTURE_AS_OF, ...args, "--json"])
}

export type Row = { account: { id: string; name: string }; kind: SimKind; amount: string }
export type Shown = { asOf: string; currency: string; rows: Row[] }

export const TX_ONE = "0194b000-0009-7000-8000-000000000009"
export const TX_TWO = "0194b000-0010-7000-8000-000000000010"

/** Two postings on one new Transaction: `amount` into `account`, against Opening. */
export function moved(
	id: string,
	account: string,
	amount: number,
	date: string,
): { tx: TxRow; posting: PostingRow[] } {
	return {
		tx: transaction(id, date),
		posting: [posting(id, 0, account, amount), posting(id, 1, FIXTURE_ACCOUNTS.opening, -amount)],
	}
}

/** The fixture plus one Transaction that moves `amount` from Opening into `account`. */
export function withOne(
	account: string,
	amount: number,
	date: string = FIXTURE_AS_OF,
): RestoreRows {
	const added = moved(TX_ONE, account, amount, date)
	return {
		...FIXTURE_ROWS,
		tx: [...FIXTURE_ROWS.tx, added.tx],
		posting: [...FIXTURE_ROWS.posting, ...added.posting],
	}
}

/** An overpaid loan (positive raw Balance) and an overdrawn asset (negative raw Balance) at once. */
export function twoUnrepresentable(): RestoreRows {
	const loan = moved(TX_ONE, FIXTURE_ACCOUNTS.loan, 20000001, FIXTURE_AS_OF)
	const cash = moved(TX_TWO, FIXTURE_ACCOUNTS.cash, -49990002, FIXTURE_AS_OF)
	return {
		...FIXTURE_ROWS,
		tx: [...FIXTURE_ROWS.tx, loan.tx, cash.tx],
		posting: [...FIXTURE_ROWS.posting, ...loan.posting, ...cash.posting],
	}
}

/** Two Transactions that each fit in the safe range but sum past it on Cash. */
export function overflowingCash(): RestoreRows {
	const ids = [TX_ONE, TX_TWO]
	const max = Number.MAX_SAFE_INTEGER
	const added = ids.map((id) => moved(id, FIXTURE_ACCOUNTS.cash, max, FIXTURE_AS_OF))
	return {
		...FIXTURE_ROWS,
		tx: [...FIXTURE_ROWS.tx, ...added.map((one) => one.tx)],
		posting: [...FIXTURE_ROWS.posting, ...added.flatMap((one) => one.posting)],
	}
}

/** The fixture's database with raw SQL applied, the way the store trigger tests seed damage. */
export function edited(home: string, ...sql: string[]): string {
	const db = new Database(join(home, "traj.db"))
	for (const statement of sql) db.run(statement)
	db.close()
	return home
}

/** The fixture's id for the Transaction one test damages. */
export const CORRUPT_TX = "0194b000-0003-7000-8000-000000000003"
export const UNBALANCE: string = `UPDATE posting SET amount = amount + 1 WHERE tx_id = '${CORRUPT_TX}' AND ordinal = 0`

const GOLDENS = new URL("./fixtures/", import.meta.url)

/** A committed golden's exact bytes, so a test compares text rather than re-deriving a shape. */
export function goldenText(name: string): Promise<string> {
	return goldenTextIn(GOLDENS, name)
}

/** The one serialization this module's goldens use: tab indents and one trailing newline. */
export { goldenJson }

/** Rewrites a golden when `TRAJ_UPDATE_GOLDEN=1` asks for a deliberate re-baseline. */
export function recordGolden(name: string, value: unknown): Promise<void> {
	return recordGoldenIn(GOLDENS, name, value)
}

function minor(amount: string, currency: string): number {
	const parsed = parseMinorUnits(amount, currency, "baseline")
	if (typeof parsed !== "number") throw new Error(`"${amount}" is not a money amount`)
	return parsed
}

/** The CLI's rows turned back into the engine's document, through the parser it formats with. */
export function baselineFrom(data: Shown): Baseline {
	return {
		schemaVersion: 1,
		balances: data.rows.map((row) => ({
			account: row.account.id,
			amount: minor(row.amount, data.currency),
		})),
	}
}
