import { expect } from "bun:test"
import type { Traj } from "./tx-test-support"

export type AddedTx = { id: string; date: string }

/** Records a simple transfer with `tx add` and returns the transaction it wrote. */
export async function addTx(
	traj: Traj,
	from: string,
	to: string,
	amount: string,
	date: string,
	project?: string,
): Promise<AddedTx> {
	const projectArgs = project === undefined ? [] : ["--project", project]
	const res = await traj([
		"tx",
		"add",
		"--from",
		from,
		"--to",
		to,
		"--amount",
		amount,
		"--date",
		date,
		...projectArgs,
		"--json",
	])
	expect(res.code).toBe(0)
	return JSON.parse(res.out).transaction as AddedTx
}
