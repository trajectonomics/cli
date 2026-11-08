import { describe, expect, it } from "bun:test"
import { accounts, cli, tempHome } from "./tx-test-support"

const document = {
	date: "2026-03-31",
	externalRef: "doc:dry",
	postings: [
		{ account: "Bank", amount: "250.00", currency: "THB" },
		{ account: "Salary", amount: "-250.00", currency: "THB" },
	],
}

describe("tx add document dry run and replay", () => {
	it("rolls a document dry run back and returns the generated id as null", async () => {
		const home = tempHome()
		const opened = await accounts(cli(home), [
			["Bank", "asset"],
			["Salary", "income"],
		])
		const dry = await cli(
			home,
			JSON.stringify(document),
		)(["tx", "add", "--postings", "-", "--dry-run", "--json"])
		expect(dry.code).toBe(0)
		const data = JSON.parse(dry.out)
		expect(data).toMatchObject({ dryRun: true, status: "added" })
		expect(data.transaction.id).toBeNull()
		expect(data.transaction.postings.map((p: { accountId: string }) => p.accountId)).toEqual([
			opened["Bank"]?.id,
			opened["Salary"]?.id,
		])
		const real = await cli(
			home,
			JSON.stringify(document),
		)(["tx", "add", "--postings", "-", "--json"])
		expect(real.code).toBe(0)
		expect(JSON.parse(real.out).status).toBe("added")
	})

	it("replays an identical document as a duplicate", async () => {
		const home = tempHome()
		await accounts(cli(home), [
			["Bank", "asset"],
			["Salary", "income"],
		])
		const run = cli(home, JSON.stringify(document))
		const first = await run(["tx", "add", "--postings", "-", "--json"])
		const again = await run(["tx", "add", "--postings", "-", "--json"])
		expect(again.code).toBe(0)
		const data = JSON.parse(again.out)
		expect(data.status).toBe("duplicate")
		expect(data.transaction.id).toBe(JSON.parse(first.out).transaction.id)
	})

	it("keeps the existing id when a dry run finds a duplicate", async () => {
		const home = tempHome()
		await accounts(cli(home), [
			["Bank", "asset"],
			["Salary", "income"],
		])
		const run = cli(home, JSON.stringify(document))
		const first = await run(["tx", "add", "--postings", "-", "--json"])
		const dry = await run(["tx", "add", "--postings", "-", "--dry-run", "--json"])
		expect(dry.code).toBe(0)
		const data = JSON.parse(dry.out)
		expect(data).toMatchObject({ dryRun: true, status: "duplicate" })
		expect(data.transaction.id).toBe(JSON.parse(first.out).transaction.id)
	})
})
