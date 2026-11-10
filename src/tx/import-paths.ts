import type { ErrorBody } from "../errors"

/** The two postings the core's `simple` writes, in ordinal order: debit is `to`, credit `from`. */
const POSTING_COLUMNS = ["to", "from"] as const

/** A leg's core field names the side; the row's column is the cell the user edits. */
const LEG_COLUMNS: Record<string, string> = {
	"to.accountId": "to",
	"from.accountId": "from",
	"to.amount": "amount",
	"from.amount": "amount",
	"to.dimensions": "project",
	"from.dimensions": "project",
}

/** The store knows postings and its own fields; the CSV knows columns and physical lines. */
export function storeField(path: string, line: number): string {
	if (path === "externalRef") return `line.${line}.external_ref`
	const posting = /^postings\.(\d+)(?:\.|$)/.exec(path)
	const column = posting === null ? undefined : POSTING_COLUMNS[Number(posting[1])]
	return column === undefined ? `line.${line}.${path}` : `line.${line}.${column}`
}

/** A build failure already names its CSV line; the core's posting field maps to the column. */
export function buildField(path: string, line: number): string {
	const prefix = `line.${line}.`
	if (!path.startsWith(prefix)) return path
	const rest = path.slice(prefix.length)
	const posting = /^postings\.(\d+)\.([a-zA-Z]+)/.exec(rest)
	if (posting !== null) {
		const column = POSTING_COLUMNS[Number(posting[1])]
		if (posting[2] === "accountId" && column !== undefined) return `${prefix}${column}`
		if (posting[2] === "amount") return `${prefix}amount`
		if (posting[2] === "dimensions") return `${prefix}project`
	}
	const [head = "", next = ""] = rest.split(".")
	const column = LEG_COLUMNS[`${head}.${next}`]
	return column === undefined ? path : `${prefix}${column}`
}

/** The reason with its path rewritten, and a message that began with the old path kept in step. */
export function atColumn(reason: ErrorBody, path: string): ErrorBody {
	if (reason.path === undefined || reason.path === path) return reason
	const prefix = `${reason.path}: `
	const message = reason.message.startsWith(prefix)
		? `${path}${reason.message.slice(reason.path.length)}`
		: reason.message
	return { ...reason, path, message }
}
