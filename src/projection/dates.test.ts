import { describe, expect, it } from "bun:test"
import { addDays, birthdayAt, monthsBetween, rowAt, yearsBetween } from "./dates"

describe("projection date arithmetic", () => {
	it("adds days in UTC and crosses a month, a year and a leap day", () => {
		expect(addDays("2026-03-30", 1)).toBe("2026-03-31")
		expect(addDays("2026-02-28", 1)).toBe("2026-03-01")
		expect(addDays("2027-12-31", 1)).toBe("2028-01-01")
		expect(addDays("2028-02-28", 1)).toBe("2028-02-29")
	})

	it("clamps a 29 February birthday to the last day of a common February", () => {
		expect(birthdayAt("1988-02-29", 40)).toBe("2028-02-29")
		expect(birthdayAt("1988-02-29", 41)).toBe("2029-02-28")
		expect(birthdayAt("1985-06-15", 45)).toBe("2030-06-15")
	})

	it("counts whole calendar months and years, with the sign of the difference", () => {
		expect(monthsBetween("2026-04-01", "2027-06-01")).toBe(14)
		expect(monthsBetween("2027-06-01", "2026-04-01")).toBe(-14)
		expect(yearsBetween("2027-06-30", "2029-06-30")).toBe(2)
	})
})

describe("the row an age reads", () => {
	const rows = [{ date: "2026-03-31" }, { date: "2026-04-30" }, { date: "2026-05-31" }]

	it("takes the last month end on or before the birthday", () => {
		expect(rowAt(rows, "2026-05-15", undefined)?.date).toBe("2026-04-30")
		expect(rowAt(rows, "2026-05-31", undefined)?.date).toBe("2026-05-31")
	})

	it("has no figure before the first row, past the last, or after a run-out", () => {
		expect(rowAt(rows, "2026-03-30", undefined)).toBeUndefined()
		expect(rowAt(rows, "2026-06-01", undefined)).toBeUndefined()
		expect(rowAt(rows, "2026-05-31", { date: "2026-04-30" })).toBeUndefined()
		expect(rowAt(rows, "2026-04-30", { date: "2026-04-30" })?.date).toBe("2026-04-30")
	})
})
