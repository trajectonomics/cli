import { describe, expect, it } from "bun:test"
import { accounts, cli, type Traj, tempHome } from "./tx-test-support"

type Posting = { account: string; amount: string; currency: string }

function doc(postings: Posting[], externalRef?: string) {
	return {
		date: "2026-03-31",
		...(externalRef === undefined ? {} : { externalRef }),
		postings,
	}
}

async function seed(traj: Traj) {
	return accounts(traj, [
		["Bank", "asset"],
		["Salary", "income"],
		["Food", "expense"],
		["Opening", "equity"],
	])
}

function errorOf(res: { err: string }) {
	return JSON.parse(res.err).error
}

describe("tx add document errors", () => {
	it("rejects unbalanced postings with the core's code and writes nothing", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seed(traj)
		const unbalanced = doc(
			[
				{ account: "Bank", amount: "100.00", currency: "THB" },
				{ account: "Salary", amount: "-90.00", currency: "THB" },
			],
			"doc:unbalanced",
		)
		const failed = await cli(
			home,
			JSON.stringify(unbalanced),
		)(["tx", "add", "--postings", "-", "--json"])
		expect(failed.code).toBe(3)
		expect(errorOf(failed)).toMatchObject({
			code: "UNBALANCED_TRANSACTION",
			exitCode: 3,
			path: "postings",
		})
		const balanced = doc(
			[
				{ account: "Bank", amount: "100.00", currency: "THB" },
				{ account: "Salary", amount: "-100.00", currency: "THB" },
			],
			"doc:unbalanced",
		)
		const retried = await cli(
			home,
			JSON.stringify(balanced),
		)(["tx", "add", "--postings", "-", "--json"])
		expect(retried.code).toBe(0)
		expect(JSON.parse(retried.out).status).toBe("added")
	})

	it("refuses to mix the document form with flag-form fields", async () => {
		const traj = cli(tempHome())
		await seed(traj)
		for (const extra of [
			["--from", "Bank"],
			["--opening"],
			["--external-ref", "mixed"],
			["--project", "x"],
		]) {
			const res = await traj(["tx", "add", "--postings", "-", ...extra, "--json"])
			expect(res.code).toBe(2)
			expect(errorOf(res)).toMatchObject({ code: "invalid_input", exitCode: 2 })
			expect(errorOf(res).message).toContain("cannot be combined")
		}
	})

	it("rejects empty, malformed and unreadable documents", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seed(traj)
		const empty = await cli(home, "")(["tx", "add", "--postings", "-", "--json"])
		expect(errorOf(empty).message).toContain("empty")
		const bad = await cli(home, "{")(["tx", "add", "--postings", "-", "--json"])
		expect(errorOf(bad).message).toContain("not valid JSON")
		const missing = await traj(["tx", "add", "--postings", "/nope/doc.json", "--json"])
		expect(errorOf(missing).message).toContain("cannot read")
		for (const res of [empty, bad, missing]) {
			expect(res.code).toBe(2)
			expect(errorOf(res).code).toBe("invalid_input")
		}
	})

	it("names a missing posting account as UNKNOWN_ACCOUNT at exit 3", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seed(traj)
		const bad = doc([
			{ account: "Nope", amount: "1.00", currency: "THB" },
			{ account: "Bank", amount: "-1.00", currency: "THB" },
		])
		const res = await cli(home, JSON.stringify(bad))(["tx", "add", "--postings", "-", "--json"])
		expect(res.code).toBe(3)
		expect(errorOf(res)).toMatchObject({
			code: "UNKNOWN_ACCOUNT",
			exitCode: 3,
			path: "postings.0.account",
		})
	})

	it("rejects a document amount above the safe-integer range", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seed(traj)
		const tooLarge = doc([
			{ account: "Bank", amount: "90071992547409.92", currency: "THB" },
			{ account: "Salary", amount: "-90071992547409.92", currency: "THB" },
		])
		const res = await cli(
			home,
			JSON.stringify(tooLarge),
		)(["tx", "add", "--postings", "-", "--json"])
		expect(res.code).toBe(3)
		expect(errorOf(res)).toMatchObject({
			code: "INVALID_AMOUNT",
			exitCode: 3,
			path: "postings.0.amount",
		})
	})

	it("rejects a document posting in an unsupported currency", async () => {
		const home = tempHome()
		const traj = cli(home)
		await seed(traj)
		const dollars = doc([
			{ account: "Bank", amount: "1.00", currency: "USD" },
			{ account: "Salary", amount: "-1.00", currency: "USD" },
		])
		const res = await cli(home, JSON.stringify(dollars))(["tx", "add", "--postings", "-", "--json"])
		expect(res.code).toBe(3)
		expect(errorOf(res)).toMatchObject({
			code: "unsupported_currency",
			exitCode: 3,
			path: "postings.0.currency",
		})
	})
})
