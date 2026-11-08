import { Database } from "bun:sqlite"
import { describe, expect, it, setSystemTime } from "bun:test"
import { must, mustOpen, tempHome } from "../store/testing"
import { exportJsonl, FIELDS, RECORD_ORDER } from "./index"
import { goldenJsonl, goldenStore } from "./testing"

const SEEDED =
	'{"record":"entity","id":"00000000-0000-7000-8000-000000000001","name":"Personal","version":1,' +
	'"createdAt":"1970-01-01T00:00:00.000Z","updatedAt":"1970-01-01T00:00:00.000Z","deletedAt":null}'

describe("exportJsonl", () => {
	it("writes the header and the seeded personal entity for a fresh database", () => {
		const store = mustOpen(tempHome())
		expect(must(exportJsonl(store))).toBe(
			`{"record":"header","formatVersion":1,"schemaVersion":1}\n${SEEDED}\n`,
		)
	})

	it("exports the golden fixture database byte for byte", async () => {
		const store = await goldenStore()
		expect(must(exportJsonl(store))).toBe(await goldenJsonl())
	})

	it("reads no clock, so exports taken at different wall-clock times are identical", async () => {
		const unreadable = () => {
			throw new Error("the export read the store clock")
		}
		const store = await goldenStore(unreadable)
		setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
		const first = must(exportJsonl(store))
		setSystemTime(new Date("2031-06-30T23:59:59.999Z"))
		const second = must(exportJsonl(store))
		setSystemTime()
		expect(second).toBe(first)
		expect(first).toBe(await goldenJsonl())
	})
	it("declares every column of every table, in column order", () => {
		// A column added to the schema but to neither FIELDS nor the golden fixture fails here.
		const snake = (key: string) => key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
		const db = new Database(mustOpen(tempHome()).path, { readonly: true })
		for (const type of RECORD_ORDER) {
			const columns = db.query<{ name: string }, []>(`PRAGMA table_info(${type})`).all()
			expect({ type, columns: columns.map((c) => c.name) }).toEqual({
				type,
				columns: Object.keys(FIELDS[type]).map(snake),
			})
		}
		db.close()
	})
})
