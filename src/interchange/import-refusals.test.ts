import { describe, expect, it } from "bun:test"
import { mustOpen, tempHome } from "../store/testing"
import { edit, goldenJsonl, refused } from "./testing"

const LUNCH = "0194b000-0004-7000-8000-000000000004"
const MISSING = "0194ffff-0000-7000-8000-000000000000"

describe("importJsonl refusals", () => {
	it("rolls back the whole import and names a dangling reference", async () => {
		const golden = await goldenJsonl()
		const text = edit(golden, `"linkedTo":"${LUNCH}"`, `"linkedTo":"${MISSING}"`)
		expect(refused(text)).toMatchObject({
			code: "invalid_input",
			details: { dangling: [{ table: "tx", column: "linked_to", parent: "tx", missing: MISSING }] },
		})
		const account = "0194a000-0002-7000-8000-000000000002"
		const posting = edit(golden, `"accountId":"${account}"`, `"accountId":"${MISSING}"`)
		expect(refused(posting).details).toEqual({
			dangling: [{ table: "posting", column: "account_id", parent: "account", missing: MISSING }],
		})
	})

	it("refuses an unknown or malformed header before writing any row", async () => {
		const golden = await goldenJsonl()
		const header = '{"record":"header","formatVersion":1,"schemaVersion":1}'
		const cases: [string, string][] = [
			['{"record":"header","formatVersion":2,"schemaVersion":1}', "line.1.formatVersion"],
			['{"record":"header","formatVersion":1,"schemaVersion":2}', "line.1.schemaVersion"],
			['{"record":"header","formatVersion":1,"schemaVersion":0}', "line.1.schemaVersion"],
			['{"record":"header","schemaVersion":1,"formatVersion":1}', "line.1"],
			['{"record":"header","formatVersion":1,"schemaVersion":1,"at":"now"}', "line.1"],
			['{"record":"entity"}', "line.1.record"],
			["not json", "line.1"],
		]
		for (const [replacement, path] of cases) {
			expect(refused(edit(golden, header, replacement))).toMatchObject({
				code: "invalid_input",
				exitCode: 2,
				path,
			})
		}
		expect(refused("").path).toBe("line.1")
	})

	it("refuses a target that holds more than the seeded personal entity", async () => {
		const store = mustOpen(tempHome())
		store.createAccount({ name: "Cash", type: "asset", currency: "THB" })
		const body = refused(await goldenJsonl(), store)
		expect(body).toMatchObject({ code: "invalid_input", details: { rows: 1 } })
	})

	it("refuses a record that does not match the declared fields", async () => {
		const golden = await goldenJsonl()
		const cases: [string, string, string, string][] = [
			['"amount":"-125.50"', '"amount":"-125.505"', "INVALID_AMOUNT", "line.18.amount"],
			['"amount":"-125.50"', '"amount":-12550', "invalid_input", "line.18.amount"],
			[
				'"currency":"THB","dimensions":null}',
				'"currency":"THB","dimensions":{}}',
				"invalid_input",
				"line.14.dimensions",
			],
			['"memo":null', '"note":null', "invalid_input", "line.11"],
			['{"record":"tx"', '{"record":"transfer"', "invalid_input", "line.10.record"],
			[
				'"version":2,"createdAt":"1970',
				'"version":"2","createdAt":"1970',
				"invalid_input",
				"line.2.version",
			],
			[
				'"updatedAt":"2026-01-01T08:00:00.000Z"',
				'"updatedAt":"2026-01-01T08:00:00Z"',
				"invalid_input",
				"line.2.updatedAt",
			],
			[
				'"entityId":"00000000-0000-7000-8000-000000000001","name":"Salary"',
				'"entityId":"other","name":"Salary"',
				"invalid_input",
				"line.4.entityId",
			],
			['"rate":0.025', '"rate":0.026', "invalid_input", "line.23.contentHash"],
			['"draft":true,', '"draft":true,"x":NaN,', "invalid_input", "line.24"],
			[
				'{"draft":true,"events":[],"schemaVersion":2}',
				'{"draft":true}',
				"invalid_input",
				"line.24.document.schemaVersion",
			],
		]
		for (const [from, to, code, path] of cases) {
			expect(refused(edit(golden, from, to))).toMatchObject({ code, path })
		}
	})

	it("refuses a repeated id of any record type at its line, before any write", async () => {
		const golden = await goldenJsonl()
		const lines = golden.split("\n")
		const cases: [string, string][] = [
			['"record":"entity"', "line.25.id"],
			['"name":"Assets"', "line.25.id"],
			['"record":"tx"', "line.25.id"],
			['"record":"posting"', "line.25.ordinal"],
			['"name":"base"', "line.25.id"],
		]
		for (const [needle, path] of cases) {
			const line = lines.find((l) => l.includes(needle))!
			const body = refused(`${golden}${line}\n`)
			expect(body).toMatchObject({
				code: "invalid_input",
				path,
				details: { firstLine: expect.any(Number) },
			})
		}
	})

	it("refuses any entity other than exactly one personal entity", async () => {
		const golden = await goldenJsonl()
		const personal = '"record":"entity","id":"00000000-0000-7000-8000-000000000001"'
		const other = '"record":"entity","id":"0194d000-0001-7000-8000-000000000001"'
		expect(refused(edit(golden, personal, other))).toMatchObject({
			code: "invalid_input",
			path: "line.2.id",
		})
		const withoutEntity = golden.split("\n").filter((l) => !l.includes('"record":"entity"'))
		expect(refused(withoutEntity.join("\n"))).toMatchObject({
			code: "invalid_input",
			path: "entity",
		})
	})

	it("refuses an empty name and an unknown account type at the line path", async () => {
		const golden = await goldenJsonl()
		const cases: [string, string, string][] = [
			['"name":"ส่วนตัว"', '"name":""', "line.2.name"],
			['"name":"Salary"', '"name":""', "line.4.name"],
			['"name":"base"', '"name":""', "line.23.name"],
			['"name":"Salary","type":"income"', '"name":"Salary","type":"revenue"', "line.4.type"],
		]
		for (const [from, to, path] of cases) {
			expect(refused(edit(golden, from, to))).toMatchObject({ code: "invalid_input", path })
		}
	})

	it("refuses rows the schema rejects, such as two live accounts with one name", async () => {
		const golden = await goldenJsonl()
		const body = refused(edit(golden, '"name":"Salary"', '"name":"อาหาร"'))
		expect(body).toEqual({
			code: "invalid_input",
			exitCode: 2,
			path: "account",
			message: "account: a row breaks a constraint of the account table.",
			details: { table: "account" },
		})
	})
})
