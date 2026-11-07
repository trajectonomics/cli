import { describe, expect, it } from "bun:test"
import { type AppError, isAppError } from "../errors"
import type { Store } from "../store"
import { mustOpen, tempHome } from "../store/testing"
import { importJsonl } from "./index"
import { goldenJsonl, tableDump } from "./testing"

const LUNCH = "0194b000-0004-7000-8000-000000000004"
const MISSING = "0194ffff-0000-7000-8000-000000000000"

/** Imports into a fresh store and asserts the refusal left every table as it was. */
function refused(text: string, store: Store = mustOpen(tempHome())): AppError["body"] {
	const before = tableDump(store)
	const outcome = importJsonl(text, store)
	if (!isAppError(outcome)) throw new Error("the import was accepted")
	expect(tableDump(store)).toEqual(before)
	return outcome.body
}

function edit(text: string, from: string, to: string): string {
	if (!text.includes(from)) throw new Error(`the fixture does not contain ${from}`)
	return text.replace(from, to)
}

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

	it("refuses rows the schema rejects, such as a repeated id", async () => {
		const golden = await goldenJsonl()
		const line = golden.split("\n").find((l) => l.includes('"name":"Assets"'))!
		const body = refused(`${golden}${line}\n`)
		expect(body).toMatchObject({ code: "invalid_input", path: "account" })
	})
})
