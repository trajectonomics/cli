import { describe, expect, it, setSystemTime } from "bun:test"
import { must, mustOpen, tempHome } from "../store/testing"
import { exportJsonl } from "./index"
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
})
