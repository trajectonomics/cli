import { describe, expect, it } from "bun:test"
import { isAppError } from "../errors"
import { formatMinorUnits, parseMinorUnits } from "./money"

function code(outcome: number | unknown): string | number {
	return isAppError(outcome) ? outcome.body.code : (outcome as number)
}

describe("money", () => {
	it("parses decimal strings into integer minor units exactly", () => {
		expect(parseMinorUnits("12345.67", "THB")).toBe(1234567)
		expect(parseMinorUnits("-0.5", "THB")).toBe(-50)
		expect(parseMinorUnits("100", "THB")).toBe(10000)
		expect(parseMinorUnits("0.10", "THB")).toBe(10)
		expect(parseMinorUnits("1.230", "THB")).toBe(123)
		expect(parseMinorUnits("1500", "JPY")).toBe(1500)
		// Exactly the largest safe integer of satang, a value a float would already have lost.
		expect(parseMinorUnits("90071992547409.91", "THB")).toBe(9007199254740991)
	})

	it("rejects a value that cannot be held exactly instead of rounding it", () => {
		const tooFine = parseMinorUnits("12.345", "THB")
		expect(code(tooFine)).toBe("INVALID_AMOUNT")
		if (isAppError(tooFine)) expect(tooFine.body).toMatchObject({ exitCode: 3, path: "amount" })
		expect(code(parseMinorUnits("1.5", "JPY"))).toBe("INVALID_AMOUNT")
		expect(code(parseMinorUnits("90071992547409.92", "THB"))).toBe("INVALID_AMOUNT")
		expect(code(parseMinorUnits("-90071992547409.92", "THB"))).toBe("INVALID_AMOUNT")
	})

	it("rejects text that is not a plain decimal", () => {
		for (const text of ["", "abc", "1e3", "+1", "01", "1.", ".5", "1,000.00", " 1", "0x10"]) {
			const outcome = parseMinorUnits(text, "THB", "postings.0.amount")
			expect(code(outcome)).toBe("invalid_input")
			if (isAppError(outcome)) expect(outcome.body.path).toBe("postings.0.amount")
		}
	})

	it("rejects an unknown currency with the core's code", () => {
		expect(code(parseMinorUnits("1", "ZZZ"))).toBe("INVALID_CURRENCY")
	})

	it("formats minor units as the canonical decimal string", () => {
		expect(formatMinorUnits(1234567, "THB")).toBe("12345.67")
		expect(formatMinorUnits(-50, "THB")).toBe("-0.50")
		expect(formatMinorUnits(-5, "THB")).toBe("-0.05")
		expect(formatMinorUnits(0, "THB")).toBe("0.00")
		expect(formatMinorUnits(9007199254740991, "THB")).toBe("90071992547409.91")
		expect(formatMinorUnits(1500, "JPY")).toBe("1500")
		expect(() => formatMinorUnits(0.5, "THB")).toThrow("safe integer")
	})
})
