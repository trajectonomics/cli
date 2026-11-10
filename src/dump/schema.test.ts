import { describe, expect, it } from "bun:test"
import { z } from "zod"
import { FIELDS, RECORD_ORDER } from "../interchange"
import { dumpRowSchema } from "./schema"
import { DUMP_TABLES } from "./view"

const TABLES = ["entity", "account", "tx", "posting", "scenario"] as const

describe("the dump row schemas", () => {
	it("declare exactly the writer's columns, in the writer's order", () => {
		for (const table of TABLES) {
			// The published JSON Schema is what `traj schema inspect` shows, so compare that.
			const published = z.toJSONSchema(dumpRowSchema[table], { io: "output" })
			const properties = published["properties"] as Record<string, unknown>
			expect({ table, keys: Object.keys(properties) }).toEqual({
				table,
				keys: Object.keys(FIELDS[table]),
			})
		}
	})

	it("cover the tables the export writes, in the export's order", () => {
		expect([...DUMP_TABLES]).toEqual([...RECORD_ORDER])
	})

	it("accept the dump's own rows and reject a column the schema does not declare", () => {
		const posting = {
			txId: "tx-1",
			ordinal: 0,
			accountId: "account-1",
			amount: "12.50",
			currency: "THB",
			dimensions: null,
		}
		expect(dumpRowSchema.posting.safeParse(posting).success).toBe(true)
		expect(dumpRowSchema.posting.safeParse({ ...posting, extra: 1 }).success).toBe(false)
	})

	it("checks a row's types, not only its keys", () => {
		const posting = {
			txId: "tx-1",
			ordinal: 0,
			accountId: "account-1",
			amount: "12.50",
			currency: "THB",
			dimensions: null,
		}
		expect(dumpRowSchema.posting.safeParse({ ...posting, amount: 1250 }).success).toBe(false)
		expect(dumpRowSchema.posting.safeParse({ ...posting, dimensions: [] }).success).toBe(false)
	})
})
