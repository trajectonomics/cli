import { existsSync, statSync } from "node:fs"
import type { Context } from "../command"
import { type AppError, isAppError } from "../errors"
import { HEAD, openStore, type RestoreCounts, type Store } from "../store"
import { sentenceOf, skipped, step } from "./checks"
import { integrityCheck, ledgerChecks } from "./ledger"
import type { DoctorCheck, DoctorResult } from "./output"

export type DatabaseFacts = DoctorResult["database"]

const NO_ROWS: RestoreCounts = { entity: 0, account: 0, tx: 0, posting: 0, scenario: 0 }

export type DatabaseRead = {
	facts: DatabaseFacts
	rows: RestoreCounts
	checks: DoctorCheck[]
	trialBalance?: DoctorResult["trialBalance"] | undefined
}

function factsOf(database: string, schemaVersion: number | null): DatabaseFacts {
	const exists = existsSync(database)
	return {
		path: database,
		exists,
		bytes: exists ? statSync(database).size : 0,
		schemaVersion,
		head: HEAD,
	}
}

/** The database could not be read: one failure, and every check that needed it skipped. */
function unreadable(facts: DatabaseFacts, detail: string, why: string): DatabaseRead {
	return {
		facts,
		rows: { ...NO_ROWS },
		checks: [
			step("database", "fail", detail),
			skipped("integrity", why),
			skipped("ledger", why),
			skipped("trialBalance", why),
		],
	}
}

/** The three store-backed checks, plus the facts the result states about the open database. */
function readOpened(
	store: Store,
	database: string,
	asOf: string | undefined,
): DatabaseRead | AppError {
	const version = store.schemaVersion()
	if (isAppError(version)) {
		return unreadable(factsOf(database, null), sentenceOf(version), "It could not be read.")
	}
	const facts = factsOf(database, version)
	const opened = step(
		"database",
		"pass",
		`${database} opens at schema version ${version} of ${HEAD}.`,
	)
	const integrity = integrityCheck(store)
	const rows = store.counts()
	if (isAppError(rows)) {
		const failed = step("ledger", "fail", sentenceOf(rows))
		return {
			facts,
			rows: { ...NO_ROWS },
			checks: [opened, integrity, failed, skipped("trialBalance", "It could not be read.")],
		}
	}
	const rest = ledgerChecks(store, asOf)
	if (isAppError(rest)) return rest
	return {
		facts,
		rows,
		checks: [opened, integrity, ...rest.checks],
		trialBalance: rest.trialBalance,
	}
}

/**
 * Opens the database and runs the checks that need it. A database it cannot open is reported,
 * not raised: that is the answer a doctor is asked for. Only the caller's `--as-of` is an error.
 */
export function databaseChecks(
	ctx: Context,
	database: string,
	asOf: string | undefined,
): DatabaseRead | AppError {
	const facts = factsOf(database, null)
	if (!facts.exists) {
		const detail = `No database at ${database}; run "traj init" or "traj restore".`
		return unreadable(facts, detail, "The database does not exist.")
	}
	const store = openStore({ env: ctx.env, clock: () => new Date() })
	if (isAppError(store)) return unreadable(facts, sentenceOf(store), "It could not be opened.")
	try {
		return readOpened(store, database, asOf)
	} finally {
		store.close()
	}
}
