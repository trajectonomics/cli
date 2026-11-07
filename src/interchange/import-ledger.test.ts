import { describe, expect, it } from "bun:test"
import { must, mustOpen, tempHome } from "../store/testing"
import { importJsonl } from "./index"
import { edit, goldenJsonl, refused } from "./testing"

const ASSETS = "0194a000-0009-7000-8000-000000000009"
const KBANK = "0194a000-0001-7000-8000-000000000001"
const FOOD = "0194a000-0003-7000-8000-000000000003"
const OLD_WALLET = "0194a000-0004-7000-8000-000000000004"
const TOMBSTONED = "0194a000-0005-7000-8000-000000000005"
const SALARY_TX = "0194b000-0002-7000-8000-000000000002"

describe("importJsonl ledger validation", () => {
	it("refuses an unbalanced transaction with the core's code", async () => {
		const text = edit(await goldenJsonl(), '"amount":"50000.00"', '"amount":"50001.00"')
		expect(refused(text)).toMatchObject({
			code: "UNBALANCED_TRANSACTION",
			exitCode: 3,
			path: `tx.${SALARY_TX}.postings`,
		})
	})

	it("refuses a posting to a tombstoned account", async () => {
		const text = edit(await goldenJsonl(), `"accountId":"${FOOD}"`, `"accountId":"${TOMBSTONED}"`)
		expect(refused(text)).toMatchObject({
			code: "UNKNOWN_ACCOUNT",
			exitCode: 3,
			details: { value: TOMBSTONED },
		})
	})

	it("refuses an account parent cycle", async () => {
		const assets = `"name":"Assets","type":"asset","currency":"THB","parentId":null`
		const cycle = `"name":"Assets","type":"asset","currency":"THB","parentId":"${KBANK}"`
		expect(refused(edit(await goldenJsonl(), assets, cycle))).toMatchObject({
			code: "INVALID_ACCOUNT_HIERARCHY",
			exitCode: 3,
		})
	})

	it("imports the golden postings to an archived account, because history stays valid", async () => {
		const store = mustOpen(tempHome())
		must(importJsonl(await goldenJsonl(), store))
		const wallet = must(store.listAccounts({ sort: "id" })).find((a) => a.id === OLD_WALLET)
		expect(wallet?.archivedAt).not.toBeNull()
		const postings = must(store.listPostings({ sort: "tx_id" }))
		expect(postings.filter((p) => p.accountId === OLD_WALLET)).toHaveLength(2)
		expect(must(store.listAccounts({ sort: "id" })).map((a) => a.id)).toContain(ASSETS)
	})
	it("refuses a USD account or posting, because v1 is THB only", async () => {
		const golden = await goldenJsonl()
		const account = edit(
			golden,
			`"currency":"THB","parentId":"${ASSETS}"`,
			`"currency":"USD","parentId":"${ASSETS}"`,
		)
		expect(refused(account)).toMatchObject({ code: "invalid_input", path: "account.0.currency" })
		const posting = edit(
			golden,
			'"currency":"THB","dimensions":null}',
			'"currency":"USD","dimensions":null}',
		)
		expect(refused(posting)).toMatchObject({ code: "invalid_input", path: "posting.0.currency" })
	})
})
