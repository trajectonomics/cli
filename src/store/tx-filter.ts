import type { TxFilter } from "./types"

/** The `AND ...` clauses narrowing a transaction query, and their bound values in order. */
export function whereOf(filter: TxFilter): { sql: string; params: string[] } {
	const clauses: string[] = []
	const params: string[] = []
	const bind = (value: string): string => {
		params.push(value)
		return "?"
	}
	if (filter.since !== undefined) clauses.push(`tx.date >= ${bind(filter.since)}`)
	if (filter.until !== undefined) clauses.push(`tx.date <= ${bind(filter.until)}`)
	if (filter.accountId !== undefined) {
		const account = bind(filter.accountId)
		clauses.push(
			`EXISTS (SELECT 1 FROM posting p WHERE p.tx_id = tx.id AND p.account_id = ${account})`,
		)
	}
	if (filter.project !== undefined) {
		const project = bind(filter.project)
		clauses.push(
			`EXISTS (SELECT 1 FROM posting p WHERE p.tx_id = tx.id
			AND json_extract(p.dimensions, '$.project') = ${project})`,
		)
	}
	if (filter.linkedTo !== undefined) clauses.push(`tx.linked_to = ${bind(filter.linkedTo)}`)
	return { sql: clauses.map((clause) => `AND ${clause}`).join("\n"), params }
}
