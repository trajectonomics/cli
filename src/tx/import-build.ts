import { type ErrorBody, fail, isAppError } from "../errors"
import type { NewTransaction, Store } from "../store"
import type { ImportColumn, ImportRow } from "./import-csv"
import { atColumn, buildField } from "./import-paths"
import type { ImportPosition } from "./import-view"
import { buildSimple } from "./simple"

/** A row cannot leave these blank; `memo` and `project` may be empty (ADR-0025). */
const REQUIRED: readonly ImportColumn[] = ["date", "from", "to", "amount", "external_ref"]

/** One rejected row as the envelope reports it. */
export type Rejected = {
	line: number
	externalRef: string | null
	status: "rejected"
	reason: ErrorBody
}

/** One row that built, with the position the store does not know. */
export type Built = ImportPosition & { tx: NewTransaction }

/** What building every row found: the rows to write, and the rows already rejected. */
export type Building = { built: Built[]; rejected: Rejected[] }

function missingCell(line: number, column: ImportColumn): ErrorBody {
	const path = `line.${line}.${column}`
	return fail("invalid_input", {
		path,
		message: `${path}: the ${column} cell is required`,
		hint: 'Run "traj tx import --template" to see the columns.',
	}).body
}

function repeatedRejectedRef(line: number, externalRef: string): ErrorBody {
	const path = `line.${line}.external_ref`
	return fail("external_ref_conflict", {
		path,
		message: `${path}: "${externalRef}" names an earlier rejected row, so its content cannot be proven identical`,
		details: { externalRef },
	}).body
}

function isRejected(outcome: Built | Rejected): outcome is Rejected {
	return "status" in outcome
}

function rejected(row: ImportRow, reason: ErrorBody): Rejected {
	return {
		line: row.line,
		externalRef: row.external_ref === "" ? null : row.external_ref,
		status: "rejected",
		reason,
	}
}

/** One row: a rejection if a required cell is blank or its reference already failed, else a build. */
function buildRow(row: ImportRow, store: Store, failedRefs: Set<string>): Built | Rejected {
	const missing = REQUIRED.find((column) => row[column] === "")
	if (missing !== undefined) {
		if (row.external_ref !== "") failedRefs.add(row.external_ref)
		return rejected(row, missingCell(row.line, missing))
	}
	const externalRef = row.external_ref
	if (failedRefs.has(externalRef)) {
		return rejected(row, repeatedRejectedRef(row.line, externalRef))
	}
	const tx = buildSimple(
		{
			from: row.from,
			to: row.to,
			amount: row.amount,
			date: row.date,
			...(row.memo === "" ? {} : { memo: row.memo }),
			...(row.project === "" ? {} : { project: row.project }),
			externalRef,
		},
		store,
		(field) => `line.${row.line}.${field}`,
	)
	if (isAppError(tx)) {
		failedRefs.add(externalRef)
		return rejected(row, atColumn(tx.body, buildField(tx.body.path ?? "", row.line)))
	}
	return { line: row.line, externalRef, tx }
}

/** Builds every row in file order, collecting rejections instead of stopping at the first one. */
export function buildAll(rows: readonly ImportRow[], store: Store): Building {
	const built: Built[] = []
	const rejectedRows: Rejected[] = []
	const failedRefs = new Set<string>()
	for (const row of rows) {
		const outcome = buildRow(row, store, failedRefs)
		if (isRejected(outcome)) rejectedRows.push(outcome)
		else built.push(outcome)
	}
	return { built, rejected: rejectedRows }
}
